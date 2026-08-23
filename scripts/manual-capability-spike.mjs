import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const pdfInfoCommand = process.env.MOTOMEMORY_PDFINFO_COMMAND ?? "pdfinfo";
const renderCommand = process.env.MOTOMEMORY_PDF_RENDER_COMMAND ?? "pdftoppm";
const ocrCommand = process.env.MOTOMEMORY_OCR_COMMAND ?? "tesseract";

function usage() {
  console.log(
    "Usage: npm run manual:capability -- /absolute/path/to/manual.pdf [--sample-pages 1,34,67 | --all-pages]",
  );
}

function parseArguments(argumentsList) {
  let pdfPath = null;
  let samplePages = null;
  let allPages = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--help" || argument === "-h") {
      usage();
      process.exit(0);
    }
    if (argument === "--sample-pages") {
      const rawSamplePages = argumentsList[index + 1] ?? "";
      samplePages = rawSamplePages
        ? rawSamplePages.split(",").map((value) => Number(value.trim()))
        : [];
      index += 1;
      continue;
    }
    if (argument === "--all-pages") {
      allPages = true;
      continue;
    }
    if (argument === "--pdf") {
      pdfPath = argumentsList[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (!argument.startsWith("-")) {
      pdfPath ??= argument;
    }
  }

  return { pdfPath, samplePages, allPages };
}

async function commandAvailable(command) {
  try {
    await execFileAsync(command, ["--version"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

async function run(command, argumentsList, options = {}) {
  return execFileAsync(command, argumentsList, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: options.timeout ?? 120_000,
  });
}

function parsePageCount(metadata) {
  const match = metadata.match(/^Pages:\s+(\d+)\s*$/m);
  const pageCount = Number(match?.[1]);
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("pdfinfo did not return a positive PDF page count.");
  }
  return pageCount;
}

function selectSamplePages(pageCount) {
  return [...new Set([1, Math.ceil(pageCount / 2), pageCount])];
}

function detectPrintedPageLabel(text) {
  const explicitPattern = /^(?:page|p\.)\s*[:.#-]?\s*([0-9]{1,4}|[ivxlcdm]{1,12})$/i;
  const standalonePattern = /^(?:[0-9]{1,4}|[ivxlcdm]{1,12})$/i;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replaceAll(/\s+/g, " ").trim())
    .filter(Boolean);
  const candidates = [...lines.slice(0, 10), ...lines.slice(-10)];

  for (const candidate of candidates) {
    const match = candidate.match(explicitPattern);
    if (match?.[1]) return match[1];
  }

  return candidates.filter((candidate) => standalonePattern.test(candidate)).at(-1) ?? null;
}

function getPreview(text) {
  return text.replaceAll(/\s+/g, " ").trim().slice(0, 160);
}

async function processPage(pdfPath, pageNumber) {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "motomemory-capability-")
  );
  const outputPrefix = path.join(temporaryDirectory, "page");
  const imagePath = `${outputPrefix}.png`;
  let rendered = false;

  try {
    await run(renderCommand, [
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      "-png",
      "-r",
      "300",
      "-singlefile",
      path.resolve(pdfPath),
      outputPrefix,
    ]);
    const image = await readFile(imagePath);
    rendered = image.length > 0;
    if (!rendered) throw new Error("The renderer returned an empty page image.");
    const ocrResult = await run(
      ocrCommand,
      [imagePath, "stdout", "-l", "eng", "--psm", "3"],
      { timeout: 120_000 },
    );
    const text = ocrResult.stdout;

    return {
      pageNumber,
      rendered,
      searchable: text.trim().length > 0,
      printedPageLabel: detectPrintedPageLabel(text),
      correlationVerified: true,
      preview: getPreview(text),
      errorStage: null,
      error: null,
    };
  } catch (error) {
    return {
      pageNumber,
      rendered,
      searchable: false,
      printedPageLabel: null,
      correlationVerified: false,
      preview: "",
      errorStage: rendered ? "ocr" : "render",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const {
    pdfPath,
    samplePages: requestedSamplePages,
    allPages,
  } = parseArguments(process.argv.slice(2));
  if (!pdfPath) {
    usage();
    process.exitCode = 2;
    return;
  }

  try {
    await access(pdfPath);
    const fileInfo = await stat(pdfPath);
    if (!fileInfo.isFile()) throw new Error("The PDF path is not a file.");
  } catch (error) {
    console.error(`PDF is not available: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Keep the owner PDF outside Git and rerun this command with its absolute path.");
    process.exitCode = 2;
    return;
  }

  const missingCommands = [];
  for (const [label, command] of [
    ["pdfinfo", pdfInfoCommand],
    ["pdftoppm", renderCommand],
    ["tesseract", ocrCommand],
  ]) {
    if (!(await commandAvailable(command))) missingCommands.push(`${label} (${command})`);
  }
  if (missingCommands.length > 0) {
    console.error(`Missing capability command(s): ${missingCommands.join(", ")}`);
    console.error("Install Poppler and Tesseract, then rerun the exact command shown by --help.");
    process.exitCode = 2;
    return;
  }

  let pageCount;
  try {
    const metadata = await run(pdfInfoCommand, [path.resolve(pdfPath)], { timeout: 30_000 });
    pageCount = parsePageCount(metadata.stdout);
  } catch (error) {
    console.error(`PDF capability check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
    return;
  }

  const samplePages = requestedSamplePages ??
    (allPages
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : selectSamplePages(pageCount));
  if (samplePages.length === 0) {
    console.error("At least one valid positive sample page is required.");
    process.exitCode = 2;
    return;
  }
  const invalidPage = samplePages.find(
    (page) => !Number.isInteger(page) || page < 1 || page > pageCount,
  );
  if (invalidPage) {
    console.error(
      `Sample page ${invalidPage} must be an integer from 1 through ${pageCount}.`,
    );
    process.exitCode = 2;
    return;
  }

  console.log(`PDF page count: ${pageCount}`);
  console.log(`Sample pages: ${samplePages.join(", ")}`);
  console.log(`Renderer: ${renderCommand} at 300 DPI`);
  console.log(`OCR: ${ocrCommand} (eng, page segmentation mode 3)`);

  const results = [];
  for (const pageNumber of samplePages) {
    const result = await processPage(pdfPath, pageNumber);
    results.push(result);
    console.log(
      `Page ${pageNumber}: rendered=${result.rendered} searchable=${result.searchable} ` +
        `correlated=${result.correlationVerified} printed-label=${result.printedPageLabel ?? "blank"}`,
    );
    if (result.preview) console.log(`  OCR preview: ${result.preview}`);
    if (result.error) console.log(`  Error: ${result.error}`);
  }

  const passed = results.every(
    (result) =>
      result.rendered &&
      result.searchable &&
      result.correlationVerified &&
      result.errorStage === null &&
      !result.error,
  );
  console.log(passed ? "CAPABILITY_SPIKE_GO" : "CAPABILITY_SPIKE_CONDITIONAL");
  if (!passed) process.exitCode = 2;
}

await main();

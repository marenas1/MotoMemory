import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { tmpdir } from "node:os";

import type { PdfPageImage, PdfReader } from "@/lib/manual/manual-types";

const execFileAsync = promisify(execFile);
const MAX_COMMAND_OUTPUT_BYTES = 4 * 1024 * 1024;
const DEFAULT_RENDER_DPI = 300;

export class PdfCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfCapabilityError";
  }
}

interface LocalPdfReaderOptions {
  pdfInfoCommand?: string;
  renderCommand?: string;
  renderDpi?: number;
}

async function runCommand(
  command: string,
  args: string[],
  timeout: number,
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(command, args, {
      encoding: "utf8",
      maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
      timeout,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PdfCapabilityError(
      `The ${command} PDF capability command failed: ${message}`,
    );
  }
}

function validatePageNumber(pageNumber: number): void {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new PdfCapabilityError("PDF page number must be a positive integer.");
  }
}

function parsePageCount(metadata: string): number {
  const match = metadata.match(/^Pages:\s+(\d+)\s*$/m);
  const pageCount = match?.[1] ? Number(match[1]) : NaN;

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new PdfCapabilityError(
      "pdfinfo did not return a positive PDF page count.",
    );
  }

  return pageCount;
}

export function createLocalPdfReader(
  options: LocalPdfReaderOptions = {},
): PdfReader {
  const pdfInfoCommand = options.pdfInfoCommand ?? "pdfinfo";
  const renderCommand = options.renderCommand ?? "pdftoppm";
  const renderDpi = options.renderDpi ?? DEFAULT_RENDER_DPI;

  return {
    async getPageCount(pdfPath) {
      const result = await runCommand(pdfInfoCommand, [path.resolve(pdfPath)], 30_000);
      return parsePageCount(result.stdout);
    },

    async renderPage(pdfPath, pageNumber): Promise<PdfPageImage> {
      validatePageNumber(pageNumber);

      const tempDirectory = await mkdtemp(
        path.join(tmpdir(), "motomemory-pdf-page-"),
      );
      const outputPrefix = path.join(tempDirectory, "rendered-page");
      const imagePath = `${outputPrefix}.png`;

      try {
        await runCommand(
          renderCommand,
          [
            "-f",
            String(pageNumber),
            "-l",
            String(pageNumber),
            "-png",
            "-r",
            String(renderDpi),
            "-singlefile",
            path.resolve(pdfPath),
            outputPrefix,
          ],
          120_000,
        );

        return {
          pageNumber,
          mimeType: "image/png",
          bytes: await readFile(imagePath),
        };
      } catch (error) {
        if (error instanceof PdfCapabilityError) {
          throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        throw new PdfCapabilityError(
          `The rendered PDF page could not be read: ${message}`,
        );
      } finally {
        await rm(tempDirectory, { recursive: true, force: true });
      }
    },
  };
}

export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    await runCommand(command, ["--version"], 10_000);
    return true;
  } catch {
    return false;
  }
}

import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { tmpdir } from "node:os";

import type {
  OcrAdapter,
  OcrContext,
  OcrResult,
  PdfPageImage,
} from "@/lib/manual/manual-types";
import { isCommandAvailable } from "@/lib/manual/pdf-reader";

const execFileAsync = promisify(execFile);
const MAX_OCR_OUTPUT_BYTES = 8 * 1024 * 1024;

export class OcrCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrCapabilityError";
  }
}

interface TesseractCliOptions {
  command?: string;
  language?: string;
  pageSegmentationMode?: number;
}

async function runTesseract(
  command: string,
  imagePath: string,
  language: string,
  pageSegmentationMode: number,
): Promise<string> {
  try {
    const result = await execFileAsync(
      command,
      [
        imagePath,
        "stdout",
        "-l",
        language,
        "--psm",
        String(pageSegmentationMode),
      ],
      {
        encoding: "utf8",
        maxBuffer: MAX_OCR_OUTPUT_BYTES,
        timeout: 120_000,
      },
    );
    return result.stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OcrCapabilityError(`The Tesseract OCR command failed: ${message}`);
  }
}

export class TesseractCliOcrAdapter implements OcrAdapter {
  readonly name = "tesseract-cli";

  private readonly command: string;
  private readonly language: string;
  private readonly pageSegmentationMode: number;

  constructor(options: TesseractCliOptions = {}) {
    this.command = options.command ?? "tesseract";
    this.language = options.language ?? "eng";
    this.pageSegmentationMode = options.pageSegmentationMode ?? 3;
  }

  async recognize(image: PdfPageImage, context: OcrContext): Promise<OcrResult> {
    if (context.pageNumber !== image.pageNumber) {
      throw new OcrCapabilityError(
        "OCR context page number does not match the rendered image page number.",
      );
    }

    const tempDirectory = await mkdtemp(
      path.join(tmpdir(), "motomemory-ocr-page-"),
    );
    const imagePath = path.join(tempDirectory, "page.png");

    try {
      await writeFile(imagePath, image.bytes);
      const text = await runTesseract(
        this.command,
        imagePath,
        this.language,
        this.pageSegmentationMode,
      );

      return {
        pageNumber: image.pageNumber,
        text,
        engine: this.name,
      };
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
}

export async function isOcrCommandAvailable(
  command = "tesseract",
): Promise<boolean> {
  return isCommandAvailable(command);
}

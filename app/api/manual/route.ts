import { NextResponse } from "next/server";

import { manualRepository } from "@/lib/data/manual-repository";
import { MOTORCYCLE_ID } from "@/lib/data/motorcycle-repository";
import { manualApiError } from "@/lib/manual/manual-api-error";
import { uploadConfiguredManual } from "@/lib/manual/manual-upload";
import type { ManualDocumentRecord } from "@/lib/manual/manual-types";
import {
  MANUAL_CONTENT_TYPE,
  MAX_MANUAL_FILE_SIZE_BYTES,
} from "@/lib/manual/manual-validation";
import { errorResponse } from "@/lib/server/api-response";
import { AppError } from "@/lib/server/errors";

export const runtime = "nodejs";

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value &&
    "type" in value
  );
}

function publicManualMetadata(manual: ManualDocumentRecord | null) {
  if (!manual) {
    return null;
  }

  const { storageKey: _storageKey, ...metadata } = manual;
  return metadata;
}

export async function GET() {
  try {
    const manual = await manualRepository.findCurrent(MOTORCYCLE_ID);
    return NextResponse.json({
      manual: publicManualMetadata(manual),
      progress: manual
        ? await manualRepository.getIngestionProgress(manual.id)
        : null,
    });
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!isUploadFile(fileValue)) {
      throw new AppError(
        "INVALID_MANUAL",
        "A PDF file is required in the file form field.",
        400,
      );
    }

    if (fileValue.size > MAX_MANUAL_FILE_SIZE_BYTES) {
      throw new AppError(
        "INVALID_MANUAL",
        `Manual files must be no larger than ${MAX_MANUAL_FILE_SIZE_BYTES} bytes.`,
        400,
      );
    }

    if (fileValue.type !== MANUAL_CONTENT_TYPE) {
      throw new AppError(
        "INVALID_MANUAL",
        "The uploaded file must use application/pdf content type.",
        400,
      );
    }

    const manual = await uploadConfiguredManual({
      fileName: fileValue.name,
      contentType: fileValue.type,
      bytes: new Uint8Array(await fileValue.arrayBuffer()),
    });

    return NextResponse.json({ manual: publicManualMetadata(manual) }, { status: 201 });
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}

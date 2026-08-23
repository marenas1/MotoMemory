import { NextResponse } from "next/server";

import { manualApiError } from "@/lib/manual/manual-api-error";
import {
  enqueueConfiguredManualIngestion,
  startConfiguredManualIngestion,
} from "@/lib/manual/manual-ingestion";
import { errorResponse } from "@/lib/server/api-response";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await startConfiguredManualIngestion();

    if (result.started || result.manual.status === "processing") {
      // OCR is deliberately server-side. The response returns immediately so
      // the Manual workspace can poll status while the worker processes pages.
      void enqueueConfiguredManualIngestion(result.manual.id).catch(() => undefined);
    }

    return NextResponse.json(result, { status: result.started ? 202 : 200 });
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}

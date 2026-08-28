import { NextResponse } from "next/server";

import { manualApiError } from "@/lib/manual/manual-api-error";
import {
  enqueueConfiguredManualIngestion,
  startConfiguredManualIngestion,
} from "@/lib/manual/manual-ingestion";
import { errorResponse } from "@/lib/server/api-response";
import { OWNER_SCOPE } from "@/lib/server/owner-scope";
import { requireOwnerMode } from "@/lib/server/mutation-guard";
import { assertSameOrigin } from "@/lib/server/same-origin";

export const runtime = "nodejs";

export async function POST(request = new Request("http://localhost/api/manual/ingest", { method: "POST" })) {
  try {
    requireOwnerMode();
    assertSameOrigin(request);
    const result = await startConfiguredManualIngestion(OWNER_SCOPE);

    if (result.started || result.manual.status === "processing") {
      // OCR is deliberately server-side. The response returns immediately so
      // the Manual workspace can poll status while the worker processes pages.
      void enqueueConfiguredManualIngestion(OWNER_SCOPE, result.manual.id).catch(() => undefined);
    }

    return NextResponse.json(result, { status: result.started ? 202 : 200 });
  } catch (error) {
    return errorResponse(manualApiError(error));
  }
}

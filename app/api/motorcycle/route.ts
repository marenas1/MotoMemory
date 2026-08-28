import { NextResponse } from "next/server";

import { getMotorcycleOverview } from "@/lib/data/motorcycle-repository";
import { errorResponse } from "@/lib/server/api-response";
import { getReadableScope } from "@/lib/server/read-access";

export async function GET() {
  try {
    const { scope } = await getReadableScope();
    return NextResponse.json(await getMotorcycleOverview(scope), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

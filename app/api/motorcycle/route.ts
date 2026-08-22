import { NextResponse } from "next/server";

import { getMotorcycleOverview } from "@/lib/data/motorcycle-repository";
import { errorResponse } from "@/lib/server/api-response";

export async function GET() {
  try {
    return NextResponse.json(await getMotorcycleOverview());
  } catch (error) {
    return errorResponse(error);
  }
}

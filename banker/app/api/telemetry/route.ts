import { NextResponse } from "next/server";

import { saveTelemetryBatch } from "@/lib/bank-repository";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.events)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Telemetry batch must include an events array."
      },
      { status: 400 }
    );
  }

  try {
    const result = await saveTelemetryBatch(body);

    if (process.env.NODE_ENV !== "production") {
      console.info("[northmaple-demo] telemetry batch received", JSON.stringify(body, null, 2));
    }

    return NextResponse.json({
      ok: true,
      received: result.received,
      storedSessionSummaries: result.storedSessionSummaries
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to persist telemetry."
      },
      { status: 500 }
    );
  }
}

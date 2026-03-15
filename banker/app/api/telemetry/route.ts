import { NextResponse } from "next/server";

import { saveTelemetryBatch } from "@/lib/bank-repository";
import { getUserFromRequest } from "@/lib/auth";
import { getRequestTelemetryContext } from "@/lib/request-fingerprint";

export async function POST(request: Request) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "Authentication required."
      },
      { status: 401 }
    );
  }

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
    const requestContext = getRequestTelemetryContext(request);
    const result = await saveTelemetryBatch(user.id, body, requestContext);

    if (process.env.NODE_ENV !== "production") {
      console.info("[northmaple-bank] telemetry batch received", JSON.stringify(body, null, 2));
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

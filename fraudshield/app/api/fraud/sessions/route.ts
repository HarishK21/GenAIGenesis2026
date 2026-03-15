import { NextResponse } from "next/server";
import { loadScoredFraudSessions } from "@/lib/fraud/session-pipeline";
import { parseSessionFilterCriteria } from "@/lib/fraud/filter-query";

export const dynamic = "force-dynamic";

/**
 * GET /api/fraud/sessions
 *
 * Reads telemetry sessions and returns model-scored sessions with
 * policy-driven thresholds and historical risk context.
 */
export async function GET(request: Request) {
  try {
    const filters = parseSessionFilterCriteria(request);
    const sessionLimit = Math.min(Math.max(filters.limit ?? 250, 1), 1000);
    const eventLimit = Math.min(Math.max(sessionLimit * 20, 1000), 10000);
    const { sessions } = await loadScoredFraudSessions({
      sessionLimit,
      eventLimit,
      filters
    });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("[FraudShield API] Error loading sessions:", error);
    return NextResponse.json([], { status: 200 });
  }
}

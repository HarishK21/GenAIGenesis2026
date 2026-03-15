import { NextResponse } from "next/server";
import {
  getCasePriority,
  loadScoredFraudSessions,
  shouldCreateCase
} from "@/lib/fraud/session-pipeline";
import { parseSessionFilterCriteria } from "@/lib/fraud/filter-query";
import type { CaseRecord } from "@/lib/fraud/types";

export const dynamic = "force-dynamic";

function getAnalystPool() {
  const configured = (process.env.FRAUD_ANALYST_POOL ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (configured.length) {
    return configured;
  }

  return ["Analyst-1", "Analyst-2", "Analyst-3"];
}

/**
 * GET /api/fraud/cases
 *
 * Derives investigation cases from model-scored sessions.
 */
export async function GET(request: Request) {
  try {
    const filters = parseSessionFilterCriteria(request);
    const sessionLimit = Math.min(Math.max(filters.limit ?? 250, 1), 1000);
    const eventLimit = Math.min(Math.max(sessionLimit * 20, 1000), 10000);
    const { feedbackBySession, policy, sessions } = await loadScoredFraudSessions({
      sessionLimit,
      eventLimit,
      filters
    });
    const analystPool = getAnalystPool();

    const cases: CaseRecord[] = [];

    for (const [index, session] of sessions.entries()) {
      const score = session.summary.currentRiskScore;
      const feedback = feedbackBySession.get(session.sessionId);
      if (shouldCreateCase(score, policy) || session.analystDecision === "Escalated") {
        const reasonCodes = session.summary.reasonCodes.length
          ? session.summary.reasonCodes.join(", ")
          : "none";
        cases.push({
          id: `case-${session.sessionId}`,
          sessionId: session.sessionId,
          priority: getCasePriority(score, policy),
          assignedAnalyst: analystPool[index % analystPool.length],
          createdTime: session.summary.lastEventTime,
          status: feedback?.caseStatus ?? "Open",
          summary: `Risk score ${score} (${Math.round(
            session.summary.riskProbability * 100
          )}% probability). Reason codes: ${reasonCodes}.`,
        });
      }
    }

    return NextResponse.json(cases);
  } catch (error) {
    console.error("[FraudShield API] Error loading cases:", error);
    return NextResponse.json([], { status: 200 });
  }
}

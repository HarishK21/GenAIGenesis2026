import { NextResponse } from "next/server";
import {
  getAlertSeverity,
  loadScoredFraudSessions,
  shouldCreateAlert
} from "@/lib/fraud/session-pipeline";
import { parseSessionFilterCriteria } from "@/lib/fraud/filter-query";
import type { AlertRecord } from "@/lib/fraud/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/fraud/alerts
 *
 * Derives alerts from model-scored sessions with shared policy thresholds.
 */
export async function GET(request: Request) {
  try {
    const filters = parseSessionFilterCriteria(request);
    const sessionLimit = Math.min(Math.max(filters.limit ?? 250, 1), 1000);
    const eventLimit = Math.min(Math.max(sessionLimit * 20, 1000), 10000);
    const { policy, sessions } = await loadScoredFraudSessions({
      sessionLimit,
      eventLimit,
      filters
    });

    const alerts: AlertRecord[] = [];

    for (const session of sessions) {
      const score = session.summary.currentRiskScore;
      if (shouldCreateAlert(score, policy)) {
        const topRiskFactor = session.summary.riskFactors[0]?.label;
        const alternateRiskFactor = session.summary.riskFactors.find(
          (factor) => factor.label !== "Erratic Mouse Movement"
        )?.label;
        alerts.push({
          id: `alert-${session.sessionId}`,
          sessionId: session.sessionId,
          severity: getAlertSeverity(score, policy),
          reason:
            score < policy.thresholds.criticalAlert
              ? alternateRiskFactor ?? topRiskFactor ?? "Behavioral anomaly detected"
              : topRiskFactor ?? "Behavioral anomaly detected",
          timestamp: session.summary.lastEventTime,
          status: "Open",
        } satisfies AlertRecord);
      }
    }

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("[FraudShield API] Error loading alerts:", error);
    return NextResponse.json([], { status: 200 });
  }
}

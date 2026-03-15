import { NextResponse } from "next/server";
import { loadScoredFraudSessions } from "@/lib/fraud/session-pipeline";
import { parseSessionFilterCriteria } from "@/lib/fraud/filter-query";
import {
  type BinaryClassificationMetrics,
  type FeatureDriftMetric,
  type FraudMonitoringSnapshot,
  type ModelComparisonSnapshot,
  type FraudSession,
  type TierEvaluationMetric
} from "@/lib/fraud/types";

export const dynamic = "force-dynamic";

type LabeledSession = {
  sessionId: string;
  score: number;
  outcome: "fraud" | "legit";
};

type FeatureProjection = {
  key: string;
  value: number;
};

function mean(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, current) => sum + current, 0) / values.length;
}

function safeDivide(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function toTierMetric(
  labeled: LabeledSession[],
  threshold: number
): TierEvaluationMetric {
  const predictedPositive = labeled.filter((item) => item.score >= threshold).length;
  const truePositive = labeled.filter(
    (item) => item.score >= threshold && item.outcome === "fraud"
  ).length;
  const falsePositive = labeled.filter(
    (item) => item.score >= threshold && item.outcome === "legit"
  ).length;
  const falseNegative = labeled.filter(
    (item) => item.score < threshold && item.outcome === "fraud"
  ).length;

  const precision =
    predictedPositive > 0 ? truePositive / predictedPositive : 0;
  const recall =
    truePositive + falseNegative > 0
      ? truePositive / (truePositive + falseNegative)
      : 0;

  return {
    threshold,
    predictedPositive,
    truePositive,
    falsePositive,
    falseNegative,
    precision,
    recall
  };
}

function toBinaryMetrics(
  labeled: LabeledSession[],
  threshold: number
): BinaryClassificationMetrics {
  const total = labeled.length;
  const predictedPositive = labeled.filter((item) => item.score >= threshold).length;
  const truePositive = labeled.filter(
    (item) => item.score >= threshold && item.outcome === "fraud"
  ).length;
  const falsePositive = labeled.filter(
    (item) => item.score >= threshold && item.outcome === "legit"
  ).length;
  const falseNegative = labeled.filter(
    (item) => item.score < threshold && item.outcome === "fraud"
  ).length;
  const trueNegative = labeled.filter(
    (item) => item.score < threshold && item.outcome === "legit"
  ).length;

  const precision = safeDivide(truePositive, truePositive + falsePositive);
  const recall = safeDivide(truePositive, truePositive + falseNegative);
  const f1 = safeDivide(2 * precision * recall, precision + recall);
  const falsePositiveRate = safeDivide(falsePositive, falsePositive + trueNegative);
  const falseNegativeRate = safeDivide(falseNegative, falseNegative + truePositive);

  return {
    total,
    predictedPositive,
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    precision,
    recall,
    f1,
    falsePositiveRate,
    falseNegativeRate
  };
}

function toFeatureDrift(
  feature: string,
  baselineValues: number[],
  recentValues: number[]
): FeatureDriftMetric {
  const baselineMean = mean(baselineValues);
  const recentMean = mean(recentValues);
  const absoluteShift = recentMean - baselineMean;
  const relativeShift =
    Math.abs(baselineMean) > 1e-6
      ? absoluteShift / Math.abs(baselineMean)
      : 0;

  return {
    feature,
    baselineMean,
    recentMean,
    absoluteShift,
    relativeShift,
    flagged: Math.abs(relativeShift) >= 0.35 && Math.abs(absoluteShift) > 0.5
  };
}

function projectFeatures(summary: {
  currentRiskScore: number;
  transferAmount: number;
  clickCount: number;
  submitDelayMs: number;
  avgTypingSpeed: number;
  focusChangeCount: number;
}): FeatureProjection[] {
  return [
    { key: "risk_score", value: summary.currentRiskScore },
    { key: "transfer_amount", value: summary.transferAmount },
    { key: "click_count", value: summary.clickCount },
    { key: "submit_delay_ms", value: summary.submitDelayMs },
    { key: "typing_speed", value: summary.avgTypingSpeed },
    { key: "focus_change_count", value: summary.focusChangeCount }
  ];
}

function toLabeledSessions(
  sessions: FraudSession[],
  feedbackBySession: Map<string, { outcome: "fraud" | "legit" | "unresolved" }>
) {
  return sessions
    .map((session) => {
      const outcome = feedbackBySession.get(session.sessionId)?.outcome;
      if (outcome !== "fraud" && outcome !== "legit") {
        return null;
      }

      return {
        sessionId: session.sessionId,
        score: session.summary.currentRiskScore,
        outcome
      } satisfies LabeledSession;
    })
    .filter(Boolean) as LabeledSession[];
}

function buildModelComparison(
  threshold: number,
  rulesOnlyLabeled: LabeledSession[],
  rulesPlusAiLabeled: LabeledSession[],
  rulesOnlySessions: FraudSession[],
  rulesPlusAiSessions: FraudSession[],
  rulesOnlyLatencyMs: number,
  rulesPlusAiLatencyMs: number
) {
  const rulesOnly = toBinaryMetrics(rulesOnlyLabeled, threshold);
  const rulesPlusAi = toBinaryMetrics(rulesPlusAiLabeled, threshold);

  const rulesOnlyScoreBySession = new Map(
    rulesOnlyLabeled.map((row) => [row.sessionId, row.score])
  );

  const aiAssessedSessions = rulesPlusAiSessions.filter(
    (session) => Boolean(session.summary.aiAssessment)
  ).length;
  const aiInfluencedSessions = rulesPlusAiLabeled.filter((row) => {
    const previous = rulesOnlyScoreBySession.get(row.sessionId);
    if (typeof previous !== "number") {
      return false;
    }

    return Math.abs(previous - row.score) >= 1;
  }).length;

  return {
    threshold,
    evaluatedLabeledSessions: Math.min(
      rulesOnlyLabeled.length,
      rulesPlusAiLabeled.length
    ),
    aiAssessedSessions,
    aiInfluencedSessions,
    rulesOnly,
    rulesPlusAi,
    uplift: {
      precisionDelta: rulesPlusAi.precision - rulesOnly.precision,
      recallDelta: rulesPlusAi.recall - rulesOnly.recall,
      f1Delta: rulesPlusAi.f1 - rulesOnly.f1,
      falsePositiveRateDelta:
        rulesPlusAi.falsePositiveRate - rulesOnly.falsePositiveRate
    },
    latencyMs: {
      rulesOnlyTotal: rulesOnlyLatencyMs,
      rulesPlusAiTotal: rulesPlusAiLatencyMs,
      additionalAiCost: Math.max(0, rulesPlusAiLatencyMs - rulesOnlyLatencyMs)
    }
  } satisfies ModelComparisonSnapshot;
}

export async function GET(request: Request) {
  try {
    const filters = parseSessionFilterCriteria(request);
    const sessionLimit = Math.min(Math.max(filters.limit ?? 1000, 1), 1000);
    const eventLimit = Math.min(Math.max(sessionLimit * 20, 1000), 20000);

    const rulesOnlyStart = Date.now();
    const rulesOnlyResult = await loadScoredFraudSessions({
      sessionLimit,
      eventLimit,
      filters,
      aiMode: "disabled"
    });
    const rulesOnlyLatencyMs = Date.now() - rulesOnlyStart;

    const rulesPlusAiStart = Date.now();
    const rulesPlusAiResult = await loadScoredFraudSessions({
      sessionLimit,
      eventLimit,
      filters,
      aiMode: "enabled"
    });
    const rulesPlusAiLatencyMs = Date.now() - rulesPlusAiStart;

    const { feedbackBySession, policy, sessions } = rulesPlusAiResult;

    const labeled = toLabeledSessions(sessions, feedbackBySession);
    const rulesOnlyLabeled = toLabeledSessions(
      rulesOnlyResult.sessions,
      rulesOnlyResult.feedbackBySession
    );
    const rulesPlusAiLabeled = toLabeledSessions(sessions, feedbackBySession);

    const now = Date.now();
    const recentWindowStart = now - 24 * 60 * 60 * 1000;
    const baselineWindowStart = now - 8 * 24 * 60 * 60 * 1000;

    const recentSessions = sessions.filter(
      (session) => new Date(session.summary.lastEventTime).getTime() >= recentWindowStart
    );
    const baselineSessions = sessions.filter((session) => {
      const ts = new Date(session.summary.lastEventTime).getTime();
      return ts < recentWindowStart && ts >= baselineWindowStart;
    });
    const baselineSource = baselineSessions.length ? baselineSessions : sessions;
    const recentSource = recentSessions.length ? recentSessions : sessions;

    const driftFeatureKeys = [
      "risk_score",
      "transfer_amount",
      "click_count",
      "submit_delay_ms",
      "typing_speed",
      "focus_change_count"
    ];
    const baselineFeatureValues = new Map<string, number[]>();
    const recentFeatureValues = new Map<string, number[]>();

    baselineSource.forEach((session) => {
      projectFeatures(session.summary).forEach((item) => {
        const existing = baselineFeatureValues.get(item.key) ?? [];
        baselineFeatureValues.set(item.key, [...existing, item.value]);
      });
    });
    recentSource.forEach((session) => {
      projectFeatures(session.summary).forEach((item) => {
        const existing = recentFeatureValues.get(item.key) ?? [];
        recentFeatureValues.set(item.key, [...existing, item.value]);
      });
    });

    const drift = driftFeatureKeys.map((key) =>
      toFeatureDrift(
        key,
        baselineFeatureValues.get(key) ?? [],
        recentFeatureValues.get(key) ?? []
      )
    );

    const snapshot: FraudMonitoringSnapshot = {
      generatedAt: new Date().toISOString(),
      labeledSessions: labeled.length,
      evaluation: {
        alertTier: toTierMetric(labeled, policy.thresholds.alert),
        criticalTier: toTierMetric(labeled, policy.thresholds.criticalAlert)
      },
      drift,
      comparison: buildModelComparison(
        policy.thresholds.alert,
        rulesOnlyLabeled,
        rulesPlusAiLabeled,
        rulesOnlyResult.sessions,
        sessions,
        rulesOnlyLatencyMs,
        rulesPlusAiLatencyMs
      )
    };

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[FraudShield API] Error generating metrics:", error);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        labeledSessions: 0,
        evaluation: {
          alertTier: {
            threshold: 0,
            predictedPositive: 0,
            truePositive: 0,
            falsePositive: 0,
            falseNegative: 0,
            precision: 0,
            recall: 0
          },
          criticalTier: {
            threshold: 0,
            predictedPositive: 0,
            truePositive: 0,
            falsePositive: 0,
            falseNegative: 0,
            precision: 0,
            recall: 0
          }
        },
        drift: [],
        comparison: {
          threshold: 0,
          evaluatedLabeledSessions: 0,
          aiAssessedSessions: 0,
          aiInfluencedSessions: 0,
          rulesOnly: {
            total: 0,
            predictedPositive: 0,
            truePositive: 0,
            falsePositive: 0,
            trueNegative: 0,
            falseNegative: 0,
            precision: 0,
            recall: 0,
            f1: 0,
            falsePositiveRate: 0,
            falseNegativeRate: 0
          },
          rulesPlusAi: {
            total: 0,
            predictedPositive: 0,
            truePositive: 0,
            falsePositive: 0,
            trueNegative: 0,
            falseNegative: 0,
            precision: 0,
            recall: 0,
            f1: 0,
            falsePositiveRate: 0,
            falseNegativeRate: 0
          },
          uplift: {
            precisionDelta: 0,
            recallDelta: 0,
            f1Delta: 0,
            falsePositiveRateDelta: 0
          },
          latencyMs: {
            rulesOnlyTotal: 0,
            rulesPlusAiTotal: 0,
            additionalAiCost: 0
          }
        }
      } satisfies FraudMonitoringSnapshot,
      { status: 200 }
    );
  }
}

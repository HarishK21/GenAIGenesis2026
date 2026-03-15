import {
  type BehaviorBaseline,
  type FraudRiskPolicy
} from "@/lib/fraud/types";

const DEFAULT_BEHAVIOR_BASELINE: BehaviorBaseline = {
  typingSpeedRange: [145, 265],
  hesitationRange: [0, 3],
  clickPaceRange: [4, 16],
  reviewDelayRange: [4000, 18000]
};

export const DEFAULT_FRAUD_POLICY: FraudRiskPolicy = {
  model: {
    version: "2026.03.0",
    intercept: -2.35,
    coefficients: {
      unusualAmountFlag: 1.35,
      unusualLocationFlag: 0.58,
      erraticMouseFlag: 0.95,
      rapidNavFlag: 0.72,
      hesitationHigh: 0.48,
      correctionHigh: 0.42,
      fastSubmit: 0.76,
      longSubmit: 0.35,
      sharpDirectionSpike: 0.62,
      rapidRepeatedClicks: 0.4,
      behaviorDrift: 0.65,
      destinationNewForUser: 0.68,
      amountDeviation: 0.74,
      amountZScoreAbs: 0.28,
      userTransferVelocity15m: 0.31,
      priorConfirmedFraudRate30d: 1.12,
      logTransferAmount: 0.19,
      focusChangeCount: 0.05,
      clickPace: 0.04,
      typingSpeedLow: 0.24,
      typingSpeedHigh: 0.18
    },
    calibrationSlope: 1.08,
    calibrationIntercept: -0.08
  },
  thresholds: {
    watch: 30,
    high: 60,
    alert: 30,
    criticalAlert: 60,
    caseOpen: 55,
    caseCritical: 75
  },
  behaviorBaseline: DEFAULT_BEHAVIOR_BASELINE,
  topFlagsCount: 3
};

function mergeBehaviorBaseline(
  baseline: BehaviorBaseline,
  override: Partial<BehaviorBaseline> | undefined
): BehaviorBaseline {
  if (!override) {
    return baseline;
  }

  return {
    typingSpeedRange: override.typingSpeedRange ?? baseline.typingSpeedRange,
    hesitationRange: override.hesitationRange ?? baseline.hesitationRange,
    clickPaceRange: override.clickPaceRange ?? baseline.clickPaceRange,
    reviewDelayRange: override.reviewDelayRange ?? baseline.reviewDelayRange
  };
}

export function mergeFraudPolicy(
  base: FraudRiskPolicy,
  override: Partial<FraudRiskPolicy> | null | undefined
): FraudRiskPolicy {
  if (!override) {
    return base;
  }

  return {
    model: {
      version: override.model?.version ?? base.model.version,
      intercept: override.model?.intercept ?? base.model.intercept,
      coefficients: {
        ...base.model.coefficients,
        ...(override.model?.coefficients ?? {})
      },
      calibrationSlope:
        override.model?.calibrationSlope ?? base.model.calibrationSlope,
      calibrationIntercept:
        override.model?.calibrationIntercept ?? base.model.calibrationIntercept
    },
    thresholds: {
      watch: override.thresholds?.watch ?? base.thresholds.watch,
      high: override.thresholds?.high ?? base.thresholds.high,
      alert: override.thresholds?.alert ?? base.thresholds.alert,
      criticalAlert:
        override.thresholds?.criticalAlert ?? base.thresholds.criticalAlert,
      caseOpen: override.thresholds?.caseOpen ?? base.thresholds.caseOpen,
      caseCritical:
        override.thresholds?.caseCritical ?? base.thresholds.caseCritical
    },
    behaviorBaseline: mergeBehaviorBaseline(
      base.behaviorBaseline,
      override.behaviorBaseline
    ),
    topFlagsCount: override.topFlagsCount ?? base.topFlagsCount
  };
}

export function getPolicyOverrideFromEnv() {
  const raw = process.env.FRAUD_RISK_POLICY_JSON;
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Partial<FraudRiskPolicy>;
  } catch (error) {
    console.error("[FraudShield] Invalid FRAUD_RISK_POLICY_JSON", error);
    return null;
  }
}

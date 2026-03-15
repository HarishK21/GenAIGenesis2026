import { DEFAULT_FRAUD_POLICY } from "@/lib/fraud/policy";
import {
  type BehaviorBaseline,
  type BehaviorDriftResult,
  type FraudRiskPolicy,
  type HistoricalRiskFeatures,
  type RiskFactor,
  type RiskFactorKey,
  type RiskStatus,
  type SessionSummaryInput
} from "@/lib/fraud/types";

type ContributionGroup = {
  key: RiskFactorKey;
  label: string;
  description: string;
  features: string[];
};

const CONTRIBUTION_GROUPS: ContributionGroup[] = [
  {
    key: "unusual-amount",
    label: "Unusual Amount",
    description:
      "Transfer amount materially exceeds recent behavior for this customer.",
    features: ["unusualAmountFlag", "amountDeviation", "amountZScoreAbs", "logTransferAmount"]
  },
  {
    key: "location-novelty",
    label: "Unusual Location",
    description:
      "Transfer location deviates from the profile-normal address context.",
    features: ["unusualLocationFlag"]
  },
  {
    key: "erratic-mouse",
    label: "Erratic Mouse Movement",
    description:
      "Pointer trajectory indicates abrupt or assisted interaction patterns.",
    features: ["erraticMouseFlag"]
  },
  {
    key: "rapid-navigation",
    label: "Rapid Navigation",
    description: "Session progression was faster than expected across critical steps.",
    features: ["rapidNavFlag", "clickPace"]
  },
  {
    key: "hesitation",
    label: "High Hesitation",
    description:
      "Repeated hesitation and pause behavior indicate abnormal decision friction.",
    features: ["hesitationHigh"]
  },
  {
    key: "correction-count",
    label: "High Correction Count",
    description:
      "Multiple corrective edits can indicate uncertain or manipulated input.",
    features: ["correctionHigh"]
  },
  {
    key: "short-review-submit-delay",
    label: "Suspiciously Fast Submit",
    description:
      "Review-to-submit delay was unusually short for a transfer decision.",
    features: ["fastSubmit"]
  },
  {
    key: "long-review-submit-delay",
    label: "Abnormal Review Delay",
    description:
      "Review-to-submit delay significantly exceeded expected human behavior.",
    features: ["longSubmit"]
  },
  {
    key: "sharp-direction-changes",
    label: "Sharp Direction Changes",
    description: "Mouse movement showed abrupt directional reversals.",
    features: ["sharpDirectionSpike"]
  },
  {
    key: "rapid-repeated-clicks",
    label: "Rapid Repeated Clicks",
    description: "Repeated clicks occurred in compressed intervals.",
    features: ["rapidRepeatedClicks"]
  },
  {
    key: "behavior-drift",
    label: "Behavior Drift",
    description: "Current session deviates from learned behavior baselines.",
    features: ["behaviorDrift", "typingSpeedLow", "typingSpeedHigh"]
  },
  {
    key: "destination-novelty",
    label: "Destination Novelty",
    description:
      "Transfer destination has little or no prior activity for this customer.",
    features: ["destinationNewForUser"]
  },
  {
    key: "amount-deviation",
    label: "Amount Deviation",
    description:
      "Transfer amount significantly deviates from customer historical pattern.",
    features: ["amountDeviation", "amountZScoreAbs"]
  },
  {
    key: "velocity-spike",
    label: "Velocity Spike",
    description:
      "Transfer cadence increased materially in a short period of time.",
    features: ["userTransferVelocity15m", "userTransferCount24h", "accountTransferCount24h"]
  },
  {
    key: "prior-fraud-rate",
    label: "Prior Fraud Rate",
    description:
      "Recent confirmed fraud ratio for this customer increases prior risk.",
    features: ["priorConfirmedFraudRate30d"]
  }
];

const DEFAULT_HISTORICAL_FEATURES: HistoricalRiskFeatures = {
  userTransferCount24h: 0,
  accountTransferCount24h: 0,
  destinationTransferCount30d: 0,
  destinationNewForUser: false,
  amountDeviationRatio30d: 1,
  amountZScore30d: 0,
  userTransferVelocity15m: 0,
  priorConfirmedFraudRate30d: 0
};

type FeatureVector = Record<string, number>;

export function getRiskStatus(
  score: number,
  policy: FraudRiskPolicy = DEFAULT_FRAUD_POLICY
): RiskStatus {
  if (score >= policy.thresholds.high) {
    return "High Risk";
  }

  if (score >= policy.thresholds.watch) {
    return "Watch";
  }

  return "Normal";
}

export function calculateBehaviorDrift(
  summary: SessionSummaryInput,
  baseline: BehaviorBaseline = DEFAULT_FRAUD_POLICY.behaviorBaseline
): BehaviorDriftResult {
  const deviations: string[] = [];
  const clickPace =
    summary.totalSessionDuration > 0
      ? (summary.clickCount / summary.totalSessionDuration) * 60000
      : 0;

  const [typingMin, typingMax] = baseline.typingSpeedRange;
  const [hesitationMin, hesitationMax] = baseline.hesitationRange;
  const [paceMin, paceMax] = baseline.clickPaceRange;
  const [delayMin, delayMax] = baseline.reviewDelayRange;

  if (summary.avgTypingSpeed < typingMin || summary.avgTypingSpeed > typingMax) {
    deviations.push("typing cadence outside baseline");
  }

  if (
    summary.hesitationCount < hesitationMin ||
    summary.hesitationCount > hesitationMax
  ) {
    deviations.push("hesitation pattern drifted");
  }

  if (clickPace < paceMin || clickPace > paceMax) {
    deviations.push("click pace outside expected range");
  }

  if (summary.submitDelayMs < delayMin || summary.submitDelayMs > delayMax) {
    deviations.push("review delay differs from baseline");
  }

  return {
    active: deviations.length >= 2,
    score: deviations.length,
    deviations
  };
}

function sigmoid(value: number) {
  if (value > 20) {
    return 0.999999;
  }

  if (value < -20) {
    return 0.000001;
  }

  return 1 / (1 + Math.exp(-value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeHistoricalFeatures(
  historicalFeatures: Partial<HistoricalRiskFeatures> | undefined
): HistoricalRiskFeatures {
  return {
    userTransferCount24h:
      historicalFeatures?.userTransferCount24h ??
      DEFAULT_HISTORICAL_FEATURES.userTransferCount24h,
    accountTransferCount24h:
      historicalFeatures?.accountTransferCount24h ??
      DEFAULT_HISTORICAL_FEATURES.accountTransferCount24h,
    destinationTransferCount30d:
      historicalFeatures?.destinationTransferCount30d ??
      DEFAULT_HISTORICAL_FEATURES.destinationTransferCount30d,
    destinationNewForUser:
      historicalFeatures?.destinationNewForUser ??
      DEFAULT_HISTORICAL_FEATURES.destinationNewForUser,
    amountDeviationRatio30d:
      historicalFeatures?.amountDeviationRatio30d ??
      DEFAULT_HISTORICAL_FEATURES.amountDeviationRatio30d,
    amountZScore30d:
      historicalFeatures?.amountZScore30d ??
      DEFAULT_HISTORICAL_FEATURES.amountZScore30d,
    userTransferVelocity15m:
      historicalFeatures?.userTransferVelocity15m ??
      DEFAULT_HISTORICAL_FEATURES.userTransferVelocity15m,
    priorConfirmedFraudRate30d:
      historicalFeatures?.priorConfirmedFraudRate30d ??
      DEFAULT_HISTORICAL_FEATURES.priorConfirmedFraudRate30d
  };
}

function buildFeatureVector(
  summary: SessionSummaryInput,
  behaviorDrift: BehaviorDriftResult,
  historicalFeatures: HistoricalRiskFeatures,
  baseline: BehaviorBaseline
): FeatureVector {
  const clickPace =
    summary.totalSessionDuration > 0
      ? (summary.clickCount / summary.totalSessionDuration) * 60000
      : 0;
  const [typingMin, typingMax] = baseline.typingSpeedRange;

  return {
    unusualAmountFlag: summary.unusualAmountFlag ? 1 : 0,
    unusualLocationFlag: summary.unusualLocationFlag ? 1 : 0,
    erraticMouseFlag: summary.erraticMouseFlag ? 1 : 0,
    rapidNavFlag: summary.rapidNavFlag ? 1 : 0,
    hesitationHigh: summary.hesitationCount >= 4 ? 1 : 0,
    correctionHigh: summary.correctionCount >= 3 ? 1 : 0,
    fastSubmit: summary.submitDelayMs <= 2500 ? 1 : 0,
    longSubmit: summary.submitDelayMs >= 22000 ? 1 : 0,
    sharpDirectionSpike: summary.sharpDirectionChanges >= 24 ? 1 : 0,
    rapidRepeatedClicks: summary.rapidRepeatedClicks >= 3 ? 1 : 0,
    behaviorDrift: behaviorDrift.active ? 1 : 0,
    destinationNewForUser: historicalFeatures.destinationNewForUser ? 1 : 0,
    amountDeviation: clamp(historicalFeatures.amountDeviationRatio30d - 1, 0, 8),
    amountZScoreAbs: clamp(Math.abs(historicalFeatures.amountZScore30d), 0, 8),
    userTransferVelocity15m: clamp(historicalFeatures.userTransferVelocity15m, 0, 15),
    priorConfirmedFraudRate30d: clamp(
      historicalFeatures.priorConfirmedFraudRate30d,
      0,
      1
    ),
    userTransferCount24h: clamp(historicalFeatures.userTransferCount24h / 8, 0, 4),
    accountTransferCount24h: clamp(
      historicalFeatures.accountTransferCount24h / 8,
      0,
      4
    ),
    logTransferAmount: Math.log10(Math.max(summary.transferAmount, 1)),
    focusChangeCount: clamp(summary.focusChangeCount / 10, 0, 5),
    clickPace: clamp(clickPace / 20, 0, 6),
    typingSpeedLow:
      summary.avgTypingSpeed < typingMin
        ? clamp((typingMin - summary.avgTypingSpeed) / typingMin, 0, 3)
        : 0,
    typingSpeedHigh:
      summary.avgTypingSpeed > typingMax
        ? clamp((summary.avgTypingSpeed - typingMax) / typingMax, 0, 3)
        : 0
  };
}

function getFeatureContributions(
  featureVector: FeatureVector,
  policy: FraudRiskPolicy
): Record<string, number> {
  const contributions: Record<string, number> = {};

  Object.entries(policy.model.coefficients).forEach(([name, coefficient]) => {
    const value = featureVector[name] ?? 0;
    contributions[name] = Math.max(0, coefficient * value);
  });

  return contributions;
}

function buildRiskFactors(
  contributions: Record<string, number>,
  behaviorDrift: BehaviorDriftResult,
  score: number
): RiskFactor[] {
  const groupContributions = CONTRIBUTION_GROUPS.map((group) => {
    const rawContribution = group.features.reduce(
      (total, featureName) => total + (contributions[featureName] ?? 0),
      0
    );

    return {
      group,
      rawContribution
    };
  }).filter(({ rawContribution }) => rawContribution > 0);

  const totalContribution = groupContributions.reduce(
    (total, entry) => total + entry.rawContribution,
    0
  );

  if (!totalContribution || !score) {
    return [];
  }

  return groupContributions
    .map(({ group, rawContribution }) => {
      const normalizedPoints = Math.round((rawContribution / totalContribution) * score);
      return {
        key: group.key,
        label: group.label,
        points: Math.max(1, normalizedPoints),
        description:
          group.key === "behavior-drift" && behaviorDrift.deviations.length
            ? behaviorDrift.deviations.join(", ")
            : group.description
      } satisfies RiskFactor;
    })
    .sort((left, right) => right.points - left.points);
}

export function scoreSession(
  summary: SessionSummaryInput,
  options: {
    policy?: FraudRiskPolicy;
    historicalFeatures?: Partial<HistoricalRiskFeatures>;
  } = {}
) {
  const policy = options.policy ?? DEFAULT_FRAUD_POLICY;
  const historicalFeatures = normalizeHistoricalFeatures(options.historicalFeatures);
  const behaviorDrift = calculateBehaviorDrift(summary, policy.behaviorBaseline);
  const featureVector = buildFeatureVector(
    summary,
    behaviorDrift,
    historicalFeatures,
    policy.behaviorBaseline
  );

  const linearScore = Object.entries(policy.model.coefficients).reduce(
    (total, [name, coefficient]) => total + (featureVector[name] ?? 0) * coefficient,
    policy.model.intercept
  );

  const calibratedLogit =
    policy.model.calibrationSlope * linearScore +
    policy.model.calibrationIntercept;
  const riskProbability = clamp(sigmoid(calibratedLogit), 0, 1);
  const currentRiskScore = Math.round(riskProbability * 100);

  const contributions = getFeatureContributions(featureVector, policy);
  const riskFactors = buildRiskFactors(contributions, behaviorDrift, currentRiskScore);
  const topFlags = riskFactors
    .slice(0, policy.topFlagsCount)
    .map((factor) => factor.label);
  const reasonCodes = riskFactors
    .slice(0, policy.topFlagsCount)
    .map((factor) => factor.key);

  return {
    currentRiskScore,
    riskProbability,
    status: getRiskStatus(currentRiskScore, policy),
    riskFactors,
    topFlags,
    reasonCodes,
    modelVersion: policy.model.version,
    behaviorDrift,
    historicalFeatures
  };
}

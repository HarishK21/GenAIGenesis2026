export type TelemetryEventType =
  | "page_view"
  | "page_dwell"
  | "nav_click"
  | "account_card_click"
  | "transfer_field_focus"
  | "transfer_amount_change"
  | "hesitation_detected"
  | "review_transfer"
  | "submit_transfer"
  | "session_summary"
  | "area_transition"
  | "rapid_navigation"
  | "rapid_repeat_click"
  | "first_click"
  | "ui_click";

export type RiskStatus = "Normal" | "Watch" | "High Risk";

export type AlertSeverity = "Low" | "Medium" | "High";

export type AlertStatus = "Open" | "Acknowledged" | "Resolved";

export type CasePriority = "Medium" | "High" | "Critical";

export type CaseStatus = "Open" | "Investigating" | "Resolved";

export type AnalystDecision = "Pending" | "Safe" | "Review" | "Escalated";

export type RiskFactorKey =
  | "unusual-amount"
  | "location-novelty"
  | "erratic-mouse"
  | "rapid-navigation"
  | "hesitation"
  | "correction-count"
  | "short-review-submit-delay"
  | "long-review-submit-delay"
  | "sharp-direction-changes"
  | "rapid-repeated-clicks"
  | "behavior-drift"
  | "destination-novelty"
  | "amount-deviation"
  | "velocity-spike"
  | "prior-fraud-rate";

export interface TelemetryEvent {
  id: string;
  sessionId: string;
  timestamp: string;
  page: string;
  eventType: TelemetryEventType;
  elementId?: string;
  userId?: string;
  testRunId?: string;
  agentId?: string;
  scenarioId?: string;
  geoRegion?: string;
  deviceLabel?: string;
  dwellTime?: number;
  timeBeforeFirstClick?: number;
  clickSequence?: string[];
  mouseTravelDistance?: number;
  sharpDirectionChanges?: number;
  hesitationCount?: number;
  avgTypingSpeed?: number;
  correctionCount?: number;
  focusChangeCount?: number;
  transferAmount?: number;
  unusualAmountFlag?: boolean;
  unusualLocationFlag?: boolean;
  rapidNavFlag?: boolean;
  rapidRepeatedClicks?: number;
  reviewToSubmitDelayMs?: number;
}

export interface SessionSummaryInput {
  totalSessionDuration: number;
  clickCount: number;
  avgTypingSpeed: number;
  correctionCount: number;
  hesitationCount: number;
  unusualAmountFlag: boolean;
  erraticMouseFlag: boolean;
  rapidNavFlag: boolean;
  submitDelayMs: number;
  transferAmount: number;
  unusualLocationFlag?: boolean;
  currentPage: string;
  lastEventTime: string;
  submitted: boolean;
  timeBeforeFirstClick: number;
  avgDwellTime: number;
  focusChangeCount: number;
  mouseTravelDistance: number;
  sharpDirectionChanges: number;
  rapidRepeatedClicks: number;
  userId?: string;
  testRunId?: string;
  agentId?: string;
  scenarioId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  sessionCreatedAt?: string;
}

export interface BehaviorBaseline {
  typingSpeedRange: [number, number];
  hesitationRange: [number, number];
  clickPaceRange: [number, number];
  reviewDelayRange: [number, number];
}

export interface BehaviorDriftResult {
  active: boolean;
  score: number;
  deviations: string[];
}

export interface RiskFactor {
  key: RiskFactorKey;
  label: string;
  points: number;
  description: string;
}

export interface HistoricalRiskFeatures {
  userTransferCount24h: number;
  accountTransferCount24h: number;
  destinationTransferCount30d: number;
  destinationNewForUser: boolean;
  amountDeviationRatio30d: number;
  amountZScore30d: number;
  userTransferVelocity15m: number;
  priorConfirmedFraudRate30d: number;
}

export interface RiskThresholdPolicy {
  watch: number;
  high: number;
  alert: number;
  criticalAlert: number;
  caseOpen: number;
  caseCritical: number;
}

export interface FraudModelParameters {
  version: string;
  intercept: number;
  coefficients: Record<string, number>;
  calibrationSlope: number;
  calibrationIntercept: number;
}

export interface FraudRiskPolicy {
  model: FraudModelParameters;
  thresholds: RiskThresholdPolicy;
  behaviorBaseline: BehaviorBaseline;
  topFlagsCount: number;
}

export interface SessionSummary extends SessionSummaryInput {
  currentRiskScore: number;
  riskProbability: number;
  status: RiskStatus;
  riskFactors: RiskFactor[];
  topFlags: string[];
  reasonCodes: RiskFactorKey[];
  modelVersion: string;
  behaviorDrift: BehaviorDriftResult;
  historicalFeatures: HistoricalRiskFeatures;
}

export interface FraudSession {
  sessionId: string;
  userId?: string;
  testRunId?: string;
  agentId?: string;
  scenarioId?: string;
  accountId: string;
  accountHolder: string;
  deviceLabel: string;
  geoRegion: string;
  analystDecision: AnalystDecision;
  events: TelemetryEvent[];
  summary: SessionSummary;
}

export interface AlertRecord {
  id: string;
  sessionId: string;
  severity: AlertSeverity;
  reason: string;
  timestamp: string;
  status: AlertStatus;
}

export interface CaseRecord {
  id: string;
  sessionId: string;
  priority: CasePriority;
  assignedAnalyst: string;
  createdTime: string;
  status: CaseStatus;
  summary: string;
}

export type AnalystOutcome = "fraud" | "legit" | "unresolved";

export interface AnalystFeedbackRecord {
  sessionId: string;
  analystDecision: AnalystDecision;
  outcome: AnalystOutcome;
  caseStatus?: CaseStatus;
  notes?: string;
  updatedAt: string;
}

export interface TierEvaluationMetric {
  threshold: number;
  predictedPositive: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
}

export interface FeatureDriftMetric {
  feature: string;
  baselineMean: number;
  recentMean: number;
  absoluteShift: number;
  relativeShift: number;
  flagged: boolean;
}

export interface FraudMonitoringSnapshot {
  generatedAt: string;
  labeledSessions: number;
  evaluation: {
    alertTier: TierEvaluationMetric;
    criticalTier: TierEvaluationMetric;
  };
  drift: FeatureDriftMetric[];
}

export interface OverviewMetricCard {
  label: string;
  value: string;
  change: string;
  tone: "neutral" | "warning" | "critical" | "success";
}

export interface RiskDistributionPoint {
  label: string;
  count: number;
}

export interface AlertsOverTimePoint {
  label: string;
  low: number;
  medium: number;
  high: number;
  total: number;
}

export interface OverviewMetrics {
  activeSessions: number;
  flaggedSessions: number;
  highRiskTransfers: number;
  averageRiskScore: number;
  riskDistribution: RiskDistributionPoint[];
  alertsOverTime: AlertsOverTimePoint[];
  recentFlaggedSessions: FraudSession[];
  recentAlerts: AlertRecord[];
}

export type DataSourceMode = "mock" | "live";

export interface SessionFilterCriteria {
  userId?: string;
  testRunId?: string;
  agentId?: string;
  scenarioId?: string;
}

export interface FraudDashboardSnapshot {
  sessions: FraudSession[];
  alerts: AlertRecord[];
  cases: CaseRecord[];
  monitoring?: FraudMonitoringSnapshot | null;
  mode: DataSourceMode;
  updatedAt: string;
}

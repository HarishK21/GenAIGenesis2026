import { getDb } from "@/lib/mongodb";
import {
  DEFAULT_FRAUD_POLICY,
  getPolicyOverrideFromEnv,
  mergeFraudPolicy
} from "@/lib/fraud/policy";
import { scoreSession } from "@/lib/fraud/scoring";
import {
  type AlertSeverity,
  type AnalystDecision,
  type AnalystFeedbackRecord,
  type AnalystOutcome,
  type CasePriority,
  type CaseStatus,
  type FraudRiskPolicy,
  type FraudSession,
  type HistoricalRiskFeatures,
  type SessionFilterCriteria,
  type SessionSummaryInput,
  type TelemetryEventType
} from "@/lib/fraud/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_15M_MS = 15 * 60 * 1000;
const WINDOW_30D_MS = 30 * DAY_MS;

type RawSessionDoc = {
  _id?: unknown;
  sessionId?: unknown;
  userId?: unknown;
  testRunId?: unknown;
  agentId?: unknown;
  scenarioId?: unknown;
  geoRegion?: unknown;
  deviceLabel?: unknown;
  unusualLocationFlag?: unknown;
  page?: unknown;
  metadata?: unknown;
  updatedAt?: unknown;
};

type RawEventDoc = {
  _id?: unknown;
  sessionId?: unknown;
  userId?: unknown;
  testRunId?: unknown;
  agentId?: unknown;
  scenarioId?: unknown;
  geoRegion?: unknown;
  deviceLabel?: unknown;
  timestamp?: unknown;
  page?: unknown;
  eventType?: unknown;
  elementId?: unknown;
  metadata?: unknown;
};

interface LoadScoredFraudSessionsOptions {
  sessionLimit?: number;
  eventLimit?: number;
  filters?: SessionFilterCriteria;
}

type HistoryPoint = {
  timestamp: number;
  amount: number;
  destinationAccountId: string;
  outcome: AnalystOutcome;
};

const ANALYST_DECISIONS: AnalystDecision[] = [
  "Pending",
  "Safe",
  "Review",
  "Escalated"
];
const OUTCOMES: AnalystOutcome[] = ["fraud", "legit", "unresolved"];
const CASE_STATUSES: CaseStatus[] = ["Open", "Investigating", "Resolved"];
const TELEMETRY_EVENT_TYPES: TelemetryEventType[] = [
  "page_view",
  "page_dwell",
  "nav_click",
  "account_card_click",
  "transfer_field_focus",
  "transfer_amount_change",
  "hesitation_detected",
  "review_transfer",
  "submit_transfer",
  "session_summary",
  "area_transition",
  "rapid_navigation",
  "rapid_repeat_click",
  "first_click",
  "ui_click"
];

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function asOptionalString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return undefined;
}

function asOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function asTimestamp(value: unknown, fallback = Date.now()) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return fallback;
}

function normalizeDecision(value: unknown): AnalystDecision {
  const parsed = asString(value);
  return ANALYST_DECISIONS.includes(parsed as AnalystDecision)
    ? (parsed as AnalystDecision)
    : "Pending";
}

function normalizeOutcome(value: unknown): AnalystOutcome {
  const parsed = asString(value);
  return OUTCOMES.includes(parsed as AnalystOutcome)
    ? (parsed as AnalystOutcome)
    : "unresolved";
}

function normalizeCaseStatus(value: unknown): CaseStatus | undefined {
  const parsed = asString(value);
  if (!parsed) {
    return undefined;
  }

  return CASE_STATUSES.includes(parsed as CaseStatus)
    ? (parsed as CaseStatus)
    : undefined;
}

function normalizeTelemetryEventType(value: unknown): TelemetryEventType {
  const parsed = asString(value, "page_view");
  return TELEMETRY_EVENT_TYPES.includes(parsed as TelemetryEventType)
    ? (parsed as TelemetryEventType)
    : "page_view";
}

function computeMean(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, current) => sum + current, 0) / values.length;
}

function computeStdDev(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const mean = computeMean(values);
  const variance =
    values.reduce((sum, current) => sum + (current - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function mapTelemetrySummary(
  doc: RawSessionDoc,
  derivedMetrics: {
    sharpDirectionChanges: number;
    rapidRepeatedClicks: number;
    mouseTravelDistance: number;
  }
): SessionSummaryInput {
  const metadata = asRecord(doc.metadata);
  const sessionId = asString(doc.sessionId, "unknown-session");
  const sourceAccountId = asString(
    metadata.sourceAccountId ?? metadata.fromAccountId,
    asString(doc.userId, "unknown-account")
  );

  return {
    totalSessionDuration: asNumber(metadata.totalSessionDuration, 0),
    clickCount: asNumber(metadata.clickCount, 0),
    avgTypingSpeed: asNumber(metadata.avgTypingSpeed, 0),
    correctionCount: asNumber(metadata.correctionCount, 0),
    hesitationCount: asNumber(metadata.hesitationCount, 0),
    unusualAmountFlag: asBoolean(metadata.unusualAmountFlag, false),
    erraticMouseFlag: asBoolean(metadata.erraticMouseFlag, false),
    rapidNavFlag: asBoolean(metadata.rapidNavFlag, false),
    submitDelayMs: asNumber(metadata.submitDelayMs, 0),
    transferAmount: asNumber(metadata.transferAmount, 0),
    unusualLocationFlag: asBoolean(
      metadata.unusualLocationFlag ?? doc.unusualLocationFlag,
      false
    ),
    currentPage: asString(doc.page, "Transfer"),
    lastEventTime: new Date(asTimestamp(doc.updatedAt)).toISOString(),
    submitted: asBoolean(metadata.submitted, true),
    timeBeforeFirstClick: asNumber(metadata.timeBeforeFirstClick, 0),
    avgDwellTime: asNumber(metadata.avgDwellTime, 0),
    focusChangeCount: asNumber(
      metadata.focusChangeCount ?? metadata.focusChanges,
      0
    ),
    mouseTravelDistance: asNumber(
      metadata.mouseTravelDistance,
      derivedMetrics.mouseTravelDistance
    ),
    sharpDirectionChanges: asNumber(
      metadata.sharpDirectionChanges,
      derivedMetrics.sharpDirectionChanges
    ),
    rapidRepeatedClicks: asNumber(
      metadata.rapidRepeatedClicks,
      derivedMetrics.rapidRepeatedClicks
    ),
    userId: asString(doc.userId, "unknown-user"),
    testRunId: asOptionalString(
      doc.testRunId ?? metadata.testRunId ?? metadata.test_run_id
    ),
    agentId: asOptionalString(
      doc.agentId ?? metadata.agentId ?? metadata.agent_id
    ),
    scenarioId: asOptionalString(
      doc.scenarioId ?? metadata.scenarioId ?? metadata.scenario_id
    ),
    sourceAccountId,
    destinationAccountId: asString(
      metadata.destinationAccountId ?? metadata.toAccountId,
      "unknown-destination"
    ),
    sessionCreatedAt: asOptionalString(metadata.sessionCreatedAt)
  };
}

function buildHistoricalFeatures(
  rawSessions: RawSessionDoc[],
  feedbackBySession: Map<string, AnalystFeedbackRecord>
) {
  const byNewestTimestamp = [...rawSessions].sort(
    (left, right) => asTimestamp(left.updatedAt) - asTimestamp(right.updatedAt)
  );

  const userHistory = new Map<string, HistoryPoint[]>();
  const accountHistory = new Map<string, HistoryPoint[]>();
  const historicalBySession = new Map<string, HistoricalRiskFeatures>();

  byNewestTimestamp.forEach((doc) => {
    const metadata = asRecord(doc.metadata);
    const sessionId = asString(doc.sessionId, "unknown-session");
    const userId = asString(doc.userId, "unknown-user");
    const accountId = asString(
      metadata.sourceAccountId ?? metadata.fromAccountId,
      userId
    );
    const destinationAccountId = asString(
      metadata.destinationAccountId ?? metadata.toAccountId,
      "unknown-destination"
    );
    const amount = asNumber(metadata.transferAmount, 0);
    const timestamp = asTimestamp(doc.updatedAt);

    const userPoints = userHistory.get(userId) ?? [];
    const accountPoints = accountHistory.get(accountId) ?? [];

    const user24h = userPoints.filter((point) => timestamp - point.timestamp <= DAY_MS);
    const account24h = accountPoints.filter(
      (point) => timestamp - point.timestamp <= DAY_MS
    );
    const user30d = userPoints.filter(
      (point) => timestamp - point.timestamp <= WINDOW_30D_MS
    );
    const user15m = userPoints.filter(
      (point) => timestamp - point.timestamp <= WINDOW_15M_MS
    );

    const destinationTransferCount30d = user30d.filter(
      (point) => point.destinationAccountId === destinationAccountId
    ).length;

    const amountSamples = user30d
      .map((point) => point.amount)
      .filter((value) => value > 0);
    const amountMean = computeMean(amountSamples);
    const amountStdDev = computeStdDev(amountSamples);
    const amountDeviationRatio30d =
      amountMean > 0 ? amount / amountMean : 1;
    const amountZScore30d =
      amountStdDev > 0 ? (amount - amountMean) / amountStdDev : 0;

    const labeled30d = user30d.filter(
      (point) => point.outcome === "fraud" || point.outcome === "legit"
    );
    const fraudCount30d = labeled30d.filter(
      (point) => point.outcome === "fraud"
    ).length;
    const priorConfirmedFraudRate30d = labeled30d.length
      ? fraudCount30d / labeled30d.length
      : 0;

    historicalBySession.set(sessionId, {
      userTransferCount24h: user24h.length,
      accountTransferCount24h: account24h.length,
      destinationTransferCount30d,
      destinationNewForUser: destinationTransferCount30d === 0,
      amountDeviationRatio30d,
      amountZScore30d,
      userTransferVelocity15m: user15m.length,
      priorConfirmedFraudRate30d
    });

    const feedbackOutcome =
      feedbackBySession.get(sessionId)?.outcome ?? "unresolved";
    const nextPoint: HistoryPoint = {
      timestamp,
      amount,
      destinationAccountId,
      outcome: feedbackOutcome
    };

    userHistory.set(userId, [...userPoints, nextPoint]);
    accountHistory.set(accountId, [...accountPoints, nextPoint]);
  });

  return historicalBySession;
}

async function loadFeedbackBySession() {
  const db = await getDb();
  const docs = await db
    .collection("fraud_feedback")
    .find({})
    .sort({ updatedAt: -1 })
    .limit(5000)
    .toArray();

  const map = new Map<string, AnalystFeedbackRecord>();

  for (const doc of docs) {
    const sessionId = asString(doc.sessionId);
    if (!sessionId || map.has(sessionId)) {
      continue;
    }

    map.set(sessionId, {
      sessionId,
      analystDecision: normalizeDecision(doc.analystDecision),
      outcome: normalizeOutcome(doc.outcome),
      caseStatus: normalizeCaseStatus(doc.caseStatus),
      notes: asOptionalString(doc.notes),
      updatedAt: new Date(asTimestamp(doc.updatedAt)).toISOString()
    });
  }

  return map;
}

async function loadActiveFraudPolicy() {
  const db = await getDb();
  const envOverride = getPolicyOverrideFromEnv();
  const policyCollection = db.collection("fraud_risk_policies");

  const dbPolicyDoc =
    (await policyCollection.findOne(
      { isActive: true },
      { sort: { updatedAt: -1 } }
    )) ??
    (await policyCollection.findOne({}, { sort: { updatedAt: -1 } }));

  const dbPolicy =
    dbPolicyDoc && typeof dbPolicyDoc === "object"
      ? (asRecord(dbPolicyDoc.policy).model
          ? asRecord(dbPolicyDoc.policy)
          : (dbPolicyDoc as unknown as Partial<FraudRiskPolicy>))
      : null;

  return mergeFraudPolicy(
    mergeFraudPolicy(DEFAULT_FRAUD_POLICY, envOverride),
    dbPolicy as Partial<FraudRiskPolicy> | null
  );
}

async function loadUserDisplayNames(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
  if (!uniqueUserIds.length) {
    return new Map<string, string>();
  }

  const db = await getDb();
  const users = await db
    .collection("users")
    .find({ id: { $in: uniqueUserIds } })
    .project({ _id: 0, id: 1, displayName: 1, firstName: 1, lastName: 1 })
    .toArray();

  const displayNameByUserId = new Map<string, string>();
  users.forEach((userDoc) => {
    const id = asString(userDoc.id);
    if (!id) {
      return;
    }

    const displayName =
      asString(userDoc.displayName) ||
      [asString(userDoc.firstName), asString(userDoc.lastName)]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      id;
    displayNameByUserId.set(id, displayName);
  });

  return displayNameByUserId;
}

function getDerivedMetricsForSession(rawEvents: RawEventDoc[]) {
  const metadataList = rawEvents.map((event) => asRecord(event.metadata));

  return {
    sharpDirectionChanges: Math.max(
      0,
      ...metadataList.map((metadata) =>
        asNumber(metadata.directionChanges ?? metadata.sharpDirectionChanges, 0)
      )
    ),
    rapidRepeatedClicks: rawEvents.filter(
      (event) => asString(event.eventType) === "rapid_repeat_click"
    ).length,
    mouseTravelDistance: Math.max(
      0,
      ...metadataList.map((metadata) =>
        asNumber(metadata.totalDistance ?? metadata.mouseTravelDistance, 0)
      )
    )
  };
}

export async function loadScoredFraudSessions(
  options?: LoadScoredFraudSessionsOptions
) {
  const sessionLimit = options?.sessionLimit ?? 250;
  const eventLimit = options?.eventLimit ?? 5000;
  const filters = options?.filters;
  const db = await getDb();
  const sessionQuery: Record<string, unknown> = {};

  if (filters?.userId) {
    sessionQuery.userId = filters.userId;
  }

  if (filters?.testRunId) {
    sessionQuery.testRunId = filters.testRunId;
  }

  if (filters?.agentId) {
    sessionQuery.agentId = filters.agentId;
  }

  if (filters?.scenarioId) {
    sessionQuery.scenarioId = filters.scenarioId;
  }

  const [rawSessions, rawEvents, feedbackBySession, policy] = await Promise.all([
    db
      .collection<RawSessionDoc>("telemetry_sessions")
      .find(sessionQuery)
      .sort({ updatedAt: -1 })
      .limit(sessionLimit)
      .toArray(),
    db
      .collection<RawEventDoc>("telemetry_events")
      .find(sessionQuery)
      .sort({ timestamp: -1 })
      .limit(eventLimit)
      .toArray(),
    loadFeedbackBySession(),
    loadActiveFraudPolicy()
  ]);

  const rawEventsBySession = new Map<string, RawEventDoc[]>();
  rawEvents.forEach((eventDoc) => {
    const sessionId = asString(eventDoc.sessionId);
    if (!sessionId) {
      return;
    }

    const list = rawEventsBySession.get(sessionId) ?? [];
    list.push(eventDoc);
    rawEventsBySession.set(sessionId, list);
  });

  const historicalBySession = buildHistoricalFeatures(rawSessions, feedbackBySession);
  const userDisplayNameById = await loadUserDisplayNames(
    rawSessions.map((doc) => asString(doc.userId))
  );

  const sessions: FraudSession[] = rawSessions.map((doc) => {
    const sessionId = asString(doc.sessionId, "unknown-session");
    const metadata = asRecord(doc.metadata);
    const userId = asString(doc.userId, "unknown-user");
    const sourceAccountId = asString(
      metadata.sourceAccountId ?? metadata.fromAccountId,
      userId
    );
    const sessionEventsRaw = rawEventsBySession.get(sessionId) ?? [];
    const derivedMetrics = getDerivedMetricsForSession(sessionEventsRaw);
    const summaryInput = mapTelemetrySummary(doc, derivedMetrics);
    const scored = scoreSession(summaryInput, {
      policy,
      historicalFeatures: historicalBySession.get(sessionId)
    });
    const feedback = feedbackBySession.get(sessionId);

    const events = sessionEventsRaw
      .map((eventDoc, index) => {
        const eventMetadata = asRecord(eventDoc.metadata);
        return {
          id: asString(eventDoc._id, `${sessionId}-event-${index + 1}`),
          sessionId,
          timestamp: new Date(asTimestamp(eventDoc.timestamp)).toISOString(),
          page: asString(eventDoc.page, "Transfer"),
          eventType: normalizeTelemetryEventType(eventDoc.eventType),
          elementId: asOptionalString(eventDoc.elementId),
          userId: asOptionalString(eventDoc.userId ?? userId),
          testRunId: asOptionalString(
            eventDoc.testRunId ??
              eventMetadata.testRunId ??
              eventMetadata.test_run_id ??
              summaryInput.testRunId
          ),
          agentId: asOptionalString(
            eventDoc.agentId ??
              eventMetadata.agentId ??
              eventMetadata.agent_id ??
              summaryInput.agentId
          ),
          scenarioId: asOptionalString(
            eventDoc.scenarioId ??
              eventMetadata.scenarioId ??
              eventMetadata.scenario_id ??
              summaryInput.scenarioId
          ),
          geoRegion: asOptionalString(eventDoc.geoRegion ?? eventMetadata.geoRegion),
          deviceLabel: asOptionalString(
            eventDoc.deviceLabel ?? eventMetadata.deviceLabel
          ),
          dwellTime: asOptionalNumber(eventMetadata.dwellMs),
          timeBeforeFirstClick: asOptionalNumber(eventMetadata.timeBeforeFirstClickMs),
          mouseTravelDistance: asOptionalNumber(eventMetadata.totalDistance),
          sharpDirectionChanges: asOptionalNumber(eventMetadata.directionChanges),
          hesitationCount: asOptionalNumber(eventMetadata.count),
          transferAmount: asOptionalNumber(eventMetadata.transferAmount),
          unusualAmountFlag: asOptionalBoolean(eventMetadata.unusualAmountFlag),
          unusualLocationFlag: asOptionalBoolean(eventMetadata.unusualLocationFlag),
          rapidNavFlag: asOptionalBoolean(eventMetadata.rapidNavFlag),
          rapidRepeatedClicks: asOptionalNumber(eventMetadata.rapidRepeatedClicks),
          reviewToSubmitDelayMs: asOptionalNumber(eventMetadata.submitDelayMs)
        };
      })
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

    return {
      sessionId,
      userId,
      testRunId: summaryInput.testRunId,
      agentId: summaryInput.agentId,
      scenarioId: summaryInput.scenarioId,
      accountId: sourceAccountId,
      accountHolder: userDisplayNameById.get(userId) ?? userId,
      deviceLabel: asString(doc.deviceLabel ?? metadata.deviceLabel, "Unknown device"),
      geoRegion: asString(doc.geoRegion ?? metadata.geoRegion, "Unknown region"),
      analystDecision: feedback?.analystDecision ?? "Pending",
      events,
      summary: {
        ...summaryInput,
        ...scored
      }
    };
  });

  return {
    sessions,
    policy,
    feedbackBySession
  };
}

export function shouldCreateAlert(score: number, policy: FraudRiskPolicy) {
  return score >= policy.thresholds.alert;
}

export function getAlertSeverity(score: number, policy: FraudRiskPolicy): AlertSeverity {
  if (score >= policy.thresholds.criticalAlert) {
    return "High";
  }

  if (score >= policy.thresholds.alert) {
    return "Medium";
  }

  return "Low";
}

export function shouldCreateCase(score: number, policy: FraudRiskPolicy) {
  return score >= policy.thresholds.caseOpen;
}

export function getCasePriority(score: number, policy: FraudRiskPolicy): CasePriority {
  if (score >= policy.thresholds.caseCritical) {
    return "Critical";
  }

  if (score >= policy.thresholds.caseOpen) {
    return "High";
  }

  return "Medium";
}

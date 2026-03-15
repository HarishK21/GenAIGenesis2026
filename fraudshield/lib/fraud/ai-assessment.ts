import "server-only";

import {
  type AiFraudAssessment,
  type HistoricalRiskFeatures,
  type SessionSummaryInput
} from "@/lib/fraud/types";

const DEFAULT_HF_OPENAI_BASE_URL =
  "https://qyt7893blb71b5d3.us-east-2.aws.endpoints.huggingface.cloud/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

const BOOL_TRUE = new Set(["1", "true", "yes", "on"]);

const assessmentCache = new Map<
  string,
  { expiresAt: number; value: AiFraudAssessment }
>();
const inFlightAssessments = new Map<string, Promise<AiFraudAssessment | null>>();
let didWarnMissingApiKey = false;

interface ParsedAiPayload {
  risk_probability: number;
  confidence: number;
  verdict: string;
  rationale: string;
  reason_tags?: string[];
}

export interface AiAssessmentInput {
  sessionId: string;
  userId: string;
  geoRegion: string;
  deviceLabel: string;
  summary: SessionSummaryInput;
  historical: HistoricalRiskFeatures;
  baseRiskScore: number;
  topFlags: string[];
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  return BOOL_TRUE.has(value.toLowerCase());
}

function readNumberEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRiskVerdict(value: string): AiFraudAssessment["verdict"] {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "high risk" ||
    normalized === "high_risk" ||
    normalized === "high-risk" ||
    normalized === "high_fraud_risk" ||
    normalized === "highfraudrisk" ||
    normalized.includes("high")
  ) {
    return "High Risk";
  }

  if (
    normalized === "watch" ||
    normalized === "review" ||
    normalized === "medium" ||
    normalized.includes("watch") ||
    normalized.includes("review")
  ) {
    return "Watch";
  }

  return "Normal";
}

function readMessageContent(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const choices = (payload as { choices?: unknown[] }).choices;
  if (!Array.isArray(choices) || !choices.length) {
    return null;
  }

  const first = choices[0];
  if (!first || typeof first !== "object") {
    return null;
  }

  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") {
    return null;
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) =>
        typeof part === "object" && part && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : ""
      )
      .join("\n")
      .trim();
    return text || null;
  }

  const reasoning = (message as { reasoning?: unknown }).reasoning;
  if (typeof reasoning === "string" && reasoning.trim()) {
    return reasoning;
  }

  return null;
}

function extractFirstJsonObject(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return raw.slice(start, end + 1);
}

function parseAiPayload(content: string): ParsedAiPayload | null {
  const jsonBlock = extractFirstJsonObject(content);
  if (!jsonBlock) {
    return null;
  }

  const parsed = JSON.parse(jsonBlock) as ParsedAiPayload;
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if (
    typeof parsed.risk_probability !== "number" ||
    typeof parsed.confidence !== "number" ||
    typeof parsed.verdict !== "string" ||
    typeof parsed.rationale !== "string"
  ) {
    return null;
  }

  return parsed;
}

function buildCacheKey(sessionId: string, lastEventTime: string, model: string) {
  return `${sessionId}:${lastEventTime}:${model}`;
}

function pruneExpiredCacheEntries(now: number) {
  if (!assessmentCache.size) {
    return;
  }

  for (const [key, entry] of assessmentCache.entries()) {
    if (entry.expiresAt <= now) {
      assessmentCache.delete(key);
    }
  }

  // Keep cache bounded even under high churn.
  while (assessmentCache.size > 1000) {
    const firstKey = assessmentCache.keys().next().value;
    if (!firstKey) {
      break;
    }

    assessmentCache.delete(firstKey);
  }
}

function isDevMode() {
  return process.env.NODE_ENV !== "production";
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function parseRetryAfterMs(raw: string | null) {
  if (!raw) {
    return null;
  }

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return clamp(Math.round(seconds * 1000), 0, 60_000);
  }

  const absoluteTime = Date.parse(raw);
  if (!Number.isFinite(absoluteTime)) {
    return null;
  }

  return clamp(absoluteTime - Date.now(), 0, 60_000);
}

function computeRetryDelayMs(
  attempt: number,
  baseDelayMs: number,
  retryAfterMs: number | null
) {
  const jitterMs = Math.floor(Math.random() * Math.max(50, baseDelayMs));
  if (typeof retryAfterMs === "number") {
    return clamp(retryAfterMs + jitterMs, 100, 60_000);
  }

  const exponentialBackoff = baseDelayMs * 2 ** attempt;
  return clamp(exponentialBackoff + jitterMs, 100, 15_000);
}

function getAiConfig() {
  const enabled = readBooleanEnv("FRAUD_AI_ENABLED", false);
  const baseUrl = normalizeBaseUrl(
    process.env.FRAUD_AI_BASE_URL ?? DEFAULT_HF_OPENAI_BASE_URL
  );
  const model = process.env.FRAUD_AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = process.env.FRAUD_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "test";
  const timeoutMs = clamp(readNumberEnv("FRAUD_AI_TIMEOUT_MS", 2500), 500, 15_000);
  const cacheTtlMs = clamp(readNumberEnv("FRAUD_AI_CACHE_TTL_MS", 300_000), 0, 3_600_000);
  const maxRetries = clamp(readNumberEnv("FRAUD_AI_MAX_RETRIES", 2), 0, 5);
  const retryBaseDelayMs = clamp(
    readNumberEnv("FRAUD_AI_RETRY_BASE_DELAY_MS", 650),
    100,
    5_000
  );
  const maxOutputTokens = clamp(
    readNumberEnv("FRAUD_AI_MAX_OUTPUT_TOKENS", 512),
    120,
    1_200
  );

  return {
    enabled,
    baseUrl,
    model,
    apiKey,
    timeoutMs,
    cacheTtlMs,
    maxRetries,
    retryBaseDelayMs,
    maxOutputTokens
  };
}

function buildResponseFormat() {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "fraud_assessment",
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "risk_probability",
          "confidence",
          "verdict",
          "rationale",
          "reason_tags"
        ],
        properties: {
          risk_probability: { type: "number", minimum: 0, maximum: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          verdict: { type: "string" },
          rationale: { type: "string" },
          reason_tags: {
            type: "array",
            items: { type: "string" },
            maxItems: 6
          }
        }
      }
    }
  };
}

function buildSystemPrompt() {
  return [
    "You are a transaction-fraud risk assessor for retail online banking.",
    "Use the provided behavioral telemetry and historical context.",
    "Return only a compact JSON object with keys:",
    "risk_probability (0..1), confidence (0..1), verdict (Normal|Watch|High Risk), rationale, reason_tags (array)."
  ].join(" ");
}

function buildUserPrompt(input: AiAssessmentInput) {
  return JSON.stringify(
    {
      session: {
        id: input.sessionId,
        userId: input.userId,
        geoRegion: input.geoRegion,
        deviceLabel: input.deviceLabel,
        currentPage: input.summary.currentPage,
        transferAmount: input.summary.transferAmount,
        clickCount: input.summary.clickCount,
        hesitationCount: input.summary.hesitationCount,
        correctionCount: input.summary.correctionCount,
        rapidRepeatedClicks: input.summary.rapidRepeatedClicks,
        submitDelayMs: input.summary.submitDelayMs,
        unusualAmountFlag: input.summary.unusualAmountFlag,
        unusualLocationFlag: input.summary.unusualLocationFlag ?? false,
        erraticMouseFlag: input.summary.erraticMouseFlag,
        rapidNavFlag: input.summary.rapidNavFlag,
        baseRiskScore: input.baseRiskScore,
        topFlags: input.topFlags
      },
      historical: {
        destinationNewForUser: input.historical.destinationNewForUser,
        destinationTransferCount30d: input.historical.destinationTransferCount30d,
        amountDeviationRatio30d: input.historical.amountDeviationRatio30d,
        amountZScore30d: input.historical.amountZScore30d,
        userTransferCount24h: input.historical.userTransferCount24h,
        userTransferVelocity15m: input.historical.userTransferVelocity15m,
        priorConfirmedFraudRate30d: input.historical.priorConfirmedFraudRate30d
      }
    },
    null,
    0
  );
}

export function isAiFraudAssessmentEnabled() {
  return getAiConfig().enabled;
}

export function getAiAssessmentBudget() {
  return clamp(readNumberEnv("FRAUD_AI_MAX_SESSIONS_PER_REQUEST", 12), 0, 120);
}

export function getAiAssessmentConcurrency() {
  return clamp(readNumberEnv("FRAUD_AI_MAX_CONCURRENCY", 2), 1, 8);
}

async function requestAiAssessment(
  input: AiAssessmentInput,
  config: ReturnType<typeof getAiConfig>
) {
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildUserPrompt(input) }
          ],
          temperature: 0,
          max_tokens: config.maxOutputTokens,
          response_format: buildResponseFormat()
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const canRetry =
          attempt < config.maxRetries && shouldRetryStatus(response.status);
        if (isDevMode()) {
          console.warn(
            `[FraudShield AI] endpoint returned ${response.status} for session ${input.sessionId} (attempt ${attempt + 1}/${config.maxRetries + 1})`
          );
        }

        if (!canRetry) {
          return null;
        }

        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        await sleep(
          computeRetryDelayMs(attempt, config.retryBaseDelayMs, retryAfterMs)
        );
        continue;
      }

      const payload = await response.json().catch(() => null);
      const content = payload ? readMessageContent(payload) : null;
      if (!content) {
        return null;
      }

      const parsed = parseAiPayload(content);
      if (!parsed) {
        return null;
      }

      return {
        provider: "huggingface-openai-compatible",
        model: config.model,
        riskProbability: clamp(parsed.risk_probability, 0, 1),
        confidence: clamp(parsed.confidence, 0, 1),
        verdict: toRiskVerdict(parsed.verdict),
        rationale: parsed.rationale.trim() || "No rationale returned by model.",
        reasonTags:
          Array.isArray(parsed.reason_tags) && parsed.reason_tags.length
            ? parsed.reason_tags
                .map((tag) => String(tag).trim())
                .filter(Boolean)
                .slice(0, 5)
            : [],
        generatedAt: new Date().toISOString()
      } satisfies AiFraudAssessment;
    } catch (error) {
      const canRetry = attempt < config.maxRetries;
      if (isDevMode()) {
        console.warn(
          `[FraudShield AI] assessment failed for session ${input.sessionId} (attempt ${attempt + 1}/${config.maxRetries + 1}):`,
          error
        );
      }

      if (!canRetry) {
        return null;
      }

      await sleep(computeRetryDelayMs(attempt, config.retryBaseDelayMs, null));
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

export async function assessFraudRiskWithAi(
  input: AiAssessmentInput
): Promise<AiFraudAssessment | null> {
  const config = getAiConfig();
  if (!config.enabled) {
    return null;
  }

  if (!config.apiKey) {
    return null;
  }

  const hasExplicitApiKey = Boolean(
    (process.env.FRAUD_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim()
  );
  if (!hasExplicitApiKey && !didWarnMissingApiKey && isDevMode()) {
    didWarnMissingApiKey = true;
    console.warn(
      "[FraudShield AI] No explicit API key found. Using placeholder 'test' (expected for open hackathon endpoints)."
    );
  }

  const cacheKey = buildCacheKey(
    input.sessionId,
    input.summary.lastEventTime,
    config.model
  );
  const now = Date.now();
  pruneExpiredCacheEntries(now);
  const cached = assessmentCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const pending = inFlightAssessments.get(cacheKey);
  if (pending) {
    return pending;
  }

  const requestPromise = requestAiAssessment(input, config);
  inFlightAssessments.set(cacheKey, requestPromise);

  try {
    const assessment = await requestPromise;

    if (assessment && config.cacheTtlMs > 0) {
      assessmentCache.set(cacheKey, {
        value: assessment,
        expiresAt: now + config.cacheTtlMs
      });
    }

    return assessment;
  } finally {
    inFlightAssessments.delete(cacheKey);
  }
}

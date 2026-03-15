/* eslint-disable no-console */
const path = require("path");
const fs = require("fs/promises");
const { chromium } = require("playwright");

const DEFAULT_BANK_URL = process.env.BANK_URL ?? "http://localhost:3000";
const DEFAULT_FRAUD_SESSIONS_API =
  process.env.FRAUD_SESSIONS_API ?? "http://localhost:3001/api/fraud/sessions";
const DEFAULT_TEST_USER_COUNT = Number.parseInt(
  process.env.TEST_USER_COUNT ?? "50",
  10
);
const OUTPUT_DIR = path.join(process.cwd(), "testing", "session-harness", "latest");
const TEMP_VIDEO_DIR = path.join(OUTPUT_DIR, ".tmp-video");

const PHASE_PRESETS = {
  smoke: {
    total: 4,
    concurrency: 2,
    flaggedRatio: 0.5
  },
  ramp: {
    total: 20,
    concurrency: 5,
    flaggedRatio: 0.4
  },
  scale50: {
    total: 50,
    concurrency: 10,
    flaggedRatio: 0.4
  }
};

const CAPTURE_MODES = new Set(["none", "sample", "all"]);

function runLabel() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const sec = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${sec}`;
}

function toRepoPath(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function asBoolean(value, fallback = false) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function asNumber(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(argv) {
  const parsed = {};

  for (const raw of argv) {
    if (!raw.startsWith("--")) {
      continue;
    }

    const [key, value] = raw.slice(2).split("=");
    parsed[key] = value ?? "true";
  }

  return parsed;
}

function getConfig() {
  const args = parseArgs(process.argv.slice(2));
  const phase = args.phase && PHASE_PRESETS[args.phase] ? args.phase : "smoke";
  const preset = PHASE_PRESETS[phase];
  const captureMode = CAPTURE_MODES.has(args.capture) ? args.capture : "sample";
  const testUserCount =
    Number.isFinite(DEFAULT_TEST_USER_COUNT) && DEFAULT_TEST_USER_COUNT > 0
      ? DEFAULT_TEST_USER_COUNT
      : 50;

  const total = Math.max(1, Math.floor(asNumber(args.total, preset.total)));
  const concurrency = Math.max(
    1,
    Math.floor(asNumber(args.concurrency, preset.concurrency))
  );
  const flaggedRatioRaw = asNumber(args.flaggedRatio, preset.flaggedRatio);
  const flaggedRatio = Math.max(0, Math.min(1, flaggedRatioRaw));

  return {
    runId: args.runId ?? runLabel(),
    phase,
    total,
    concurrency,
    flaggedRatio,
    captureMode,
    headless: asBoolean(args.headless, true),
    bankUrl: args.bankUrl ?? DEFAULT_BANK_URL,
    fraudSessionsApi: args.fraudUrl ?? DEFAULT_FRAUD_SESSIONS_API,
    testUserCount
  };
}

function buildUserId(index, userCount) {
  const slot = (index % userCount) + 1;
  return `test-user-${String(slot).padStart(3, "0")}`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureCleanOutputDir() {
  await ensureDir(OUTPUT_DIR);
  const entries = await fs.readdir(OUTPUT_DIR).catch(() => []);
  await Promise.all(
    entries.map((entry) => fs.rm(path.join(OUTPUT_DIR, entry), { recursive: true, force: true }))
  );
  await ensureDir(TEMP_VIDEO_DIR);
}

async function waitFor(conditionFn, options = {}) {
  const timeoutMs = options.timeoutMs ?? 45_000;
  const intervalMs = options.intervalMs ?? 700;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await conditionFn();
    if (value) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(options.message ?? "Timed out waiting for condition.");
}

function buildFraudUrl(baseUrl, filters = {}) {
  const url = new URL(baseUrl);
  if (filters.testRunId) {
    url.searchParams.set("testRunId", filters.testRunId);
  }
  if (filters.userId) {
    url.searchParams.set("userId", filters.userId);
  }
  if (filters.agentId) {
    url.searchParams.set("agentId", filters.agentId);
  }
  if (filters.scenarioId) {
    url.searchParams.set("scenarioId", filters.scenarioId);
  }
  return url.toString();
}

async function fetchFraudSessions(baseUrl, filters = {}) {
  const response = await fetch(buildFraudUrl(baseUrl, filters), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions from ${buildFraudUrl(baseUrl, filters)}.`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Fraud sessions API did not return an array.");
  }

  return payload;
}

async function waitForRunSessions(fraudApi, runId, minCount) {
  return waitFor(
    async () => {
      const sessions = await fetchFraudSessions(fraudApi, { testRunId: runId });
      return sessions.length >= minCount ? sessions : null;
    },
    {
      timeoutMs: 90_000,
      intervalMs: 1_200,
      message: `Did not observe ${minCount} sessions for run ${runId}.`
    }
  );
}

async function maybeAcceptConsent(page) {
  const savePreference = page.getByRole("button", { name: "Save preference" });
  if (await savePreference.count()) {
    await savePreference.first().click();
    await page.waitForTimeout(400);
  }
}

async function loginAsUser(page, config, item) {
  const loginUrl = new URL("/login", config.bankUrl);
  loginUrl.searchParams.set("userId", item.userId);
  loginUrl.searchParams.set("autologin", "1");
  loginUrl.searchParams.set("returnTo", "/");
  loginUrl.searchParams.set("test_run_id", config.runId);
  loginUrl.searchParams.set("agent_id", item.agentId);
  loginUrl.searchParams.set("scenario_id", item.scenarioId);

  await page.goto(loginUrl.toString(), { waitUntil: "networkidle" });
  await waitFor(
    async () => (page.url().includes("/login") ? null : true),
    {
      timeoutMs: 15_000,
      intervalMs: 350,
      message: `Login did not complete for ${item.agentId}.`
    }
  );
  await maybeAcceptConsent(page);
}

async function gotoTransfer(page, options = {}) {
  const waitBeforeNavMs = options.waitBeforeNavMs ?? 0;
  if (waitBeforeNavMs > 0) {
    await page.waitForTimeout(waitBeforeNavMs);
  }

  await page.locator('[data-telemetry-id="nav-transfer"]').first().click();
  await page.waitForURL("**/transfer**");
  await page.waitForTimeout(300);
}

async function gotoActivity(page) {
  await page.locator('[data-telemetry-id="nav-activity"]').first().click();
  await page.waitForURL("**/activity**");
  await page.waitForTimeout(450);
}

async function fillTransfer(page, options) {
  const amountInput = page.locator('input[data-telemetry-field="amount"]');
  await amountInput.fill("");
  await amountInput.type(options.amount, { delay: options.amountKeyDelay ?? 14 });

  const note = page.locator('textarea[data-telemetry-field="note"]');
  await note.fill("");
  if (options.noteText) {
    await note.type(options.noteText, { delay: options.noteKeyDelay ?? 16 });
  }
}

async function submitTransfer(page, options) {
  await fillTransfer(page, options);

  if (options.preReviewWaitMs > 0) {
    await page.waitForTimeout(options.preReviewWaitMs);
  }

  await page.locator('[data-telemetry-id="transfer-review"]').click();

  if (options.reviewWaitMs > 0) {
    await page.waitForTimeout(options.reviewWaitMs);
  }

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Submit Transfer" }).click();

  await waitFor(
    async () => {
      const count = await page.locator("text=Transfer complete").first().count();
      return count > 0 ? true : null;
    },
    {
      timeoutMs: 12_000,
      intervalMs: 500,
      message: "Transfer did not complete in time."
    }
  );
}

async function doErraticMouse(page, iterations = 34) {
  let x = 320;
  let y = 390;
  await page.mouse.move(x, y);

  for (let index = 0; index < iterations; index += 1) {
    x += index % 2 === 0 ? 190 : -190;
    y += index % 3 === 0 ? 140 : -120;
    await page.mouse.move(x, y);
    await page.waitForTimeout(80);
  }
}

async function doRapidNavigation(page) {
  const sequence = ["accounts", "transfer", "activity", "transfer", "accounts", "transfer"];
  for (const name of sequence) {
    await page.locator(`[data-telemetry-id="nav-${name}"]`).first().click();
    await page.waitForTimeout(220);
  }
  await page.waitForURL("**/transfer**");
}

async function doHesitationBursts(page) {
  const note = page.locator('textarea[data-telemetry-field="note"]');
  await note.click();
  for (const value of ["a", "ab", "abc", "abcd"]) {
    await note.fill(value);
    await page.waitForTimeout(1_650);
  }
}

async function doRapidRepeatClicks(page) {
  const navTransfer = page.locator('[data-telemetry-id="nav-transfer"]').first();
  for (let index = 0; index < 4; index += 1) {
    await navTransfer.click();
    await page.waitForTimeout(120);
  }
}

function getScenarioTemplates() {
  const normal = [
    {
      scenarioId: "normal-steady-review",
      target: "unflagged",
      flow: async (page, item) => {
        await gotoTransfer(page, { waitBeforeNavMs: 2200 });
        await page.waitForTimeout(1_200);
        await submitTransfer(page, {
          amount: "10",
          noteText: "routine internal transfer",
          preReviewWaitMs: 8_000,
          reviewWaitMs: 6_000
        });
      }
    },
    {
      scenarioId: "normal-careful-typing",
      target: "unflagged",
      flow: async (page, item) => {
        await gotoTransfer(page, { waitBeforeNavMs: 2200 });
        await page.waitForTimeout(1_400);
        await submitTransfer(page, {
          amount: "10",
          noteText: "monthly transfer",
          preReviewWaitMs: 9_000,
          reviewWaitMs: 5_500
        });
      }
    }
  ];

  const flagged = [
    {
      scenarioId: "flagged-erratic-nav",
      target: "flagged",
      flow: async (page, item) => {
        await gotoTransfer(page);
        await doRapidNavigation(page);
        await doErraticMouse(page);
        await doRapidRepeatClicks(page);
        await submitTransfer(page, {
          amount: "10",
          noteText: "",
          preReviewWaitMs: 300,
          reviewWaitMs: 700
        });
      }
    },
    {
      scenarioId: "flagged-drift-bursts",
      target: "flagged",
      flow: async (page, item) => {
        await gotoTransfer(page);
        await doHesitationBursts(page);
        await doRapidNavigation(page);
        await doErraticMouse(page, 38);
        await submitTransfer(page, {
          amount: "10",
          noteText: "",
          preReviewWaitMs: 250,
          reviewWaitMs: 500
        });
      }
    }
  ];

  return { normal, flagged };
}

function buildRunPlan(config) {
  const templates = getScenarioTemplates();
  const flaggedTargetCount = Math.round(config.total * config.flaggedRatio);
  let flaggedRemaining = flaggedTargetCount;
  let unflaggedRemaining = config.total - flaggedTargetCount;
  let flaggedIndex = 0;
  let normalIndex = 0;
  let flaggedCaptureCount = 0;
  let normalCaptureCount = 0;

  return Array.from({ length: config.total }, (_, index) => {
    const preferFlagged = index % 2 === 1;
    const useFlagged =
      (preferFlagged && flaggedRemaining > 0) ||
      (unflaggedRemaining === 0 && flaggedRemaining > 0);

    const target = useFlagged ? "flagged" : "unflagged";
    const templateList = useFlagged ? templates.flagged : templates.normal;
    const templateIndex = useFlagged ? flaggedIndex : normalIndex;
    const template = templateList[templateIndex % templateList.length];

    if (useFlagged) {
      flaggedIndex += 1;
      flaggedRemaining -= 1;
    } else {
      normalIndex += 1;
      unflaggedRemaining -= 1;
    }

    let captureArtifacts = false;
    if (config.captureMode === "all") {
      captureArtifacts = true;
    } else if (config.captureMode === "sample") {
      if (target === "flagged" && flaggedCaptureCount < 2) {
        captureArtifacts = true;
        flaggedCaptureCount += 1;
      } else if (target === "unflagged" && normalCaptureCount < 2) {
        captureArtifacts = true;
        normalCaptureCount += 1;
      }
    }

    const sequence = useFlagged ? flaggedIndex : normalIndex;
    const userId = buildUserId(index, config.testUserCount);
    const normalGeoRegion = "Toronto, ON, CA";
    const flaggedGeoRegion = "Miami, FL, US";

    return {
      name: `${target}-${String(sequence).padStart(3, "0")}`,
      target,
      userId,
      agentId: `agent-${String(index + 1).padStart(3, "0")}`,
      scenarioId: template.scenarioId,
      geoRegion: useFlagged ? flaggedGeoRegion : normalGeoRegion,
      flow: template.flow,
      captureArtifacts
    };
  });
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) {
        return;
      }

      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker()
  );
  await Promise.all(workers);
  return results;
}

async function runScenario(browser, config, item) {
  const startedAt = Date.now();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: item.geoRegion
      ? {
          "x-test-geo-region": item.geoRegion
        }
      : undefined,
    ...(item.captureArtifacts
      ? {
          recordVideo: {
            dir: TEMP_VIDEO_DIR,
            size: { width: 1280, height: 720 }
          }
        }
      : {})
  });
  const page = await context.newPage();
  const video = item.captureArtifacts ? page.video() : null;

  try {
    await loginAsUser(page, config, item);
    await item.flow(page, item);
    await gotoActivity(page);

    let screenshotPath = null;
    if (item.captureArtifacts) {
      screenshotPath = path.join(OUTPUT_DIR, `${item.name}-activity.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    await context.close();

    let finalVideoPath = null;
    if (video) {
      const rawVideoPath = await video.path();
      finalVideoPath = path.join(OUTPUT_DIR, `${item.name}.webm`);
      await fs.copyFile(rawVideoPath, finalVideoPath);
      await fs.rm(rawVideoPath, { force: true });
    }

    return {
      ...item,
      status: "completed",
      durationMs: Date.now() - startedAt,
      artifacts: {
        screenshotPath: screenshotPath ? toRepoPath(screenshotPath) : null,
        videoPath: finalVideoPath ? toRepoPath(finalVideoPath) : null
      }
    };
  } catch (error) {
    await context.close().catch(() => null);
    return {
      ...item,
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      artifacts: {
        screenshotPath: null,
        videoPath: null
      }
    };
  }
}

function resolveSessionForRunItem(runSessions, runItem) {
  return (
    runSessions
      .filter((session) => session.agentId === runItem.agentId)
      .sort((left, right) =>
        right.summary.lastEventTime.localeCompare(left.summary.lastEventTime)
      )[0] ?? null
  );
}

function summarizeResults(runResults) {
  const successful = runResults.filter((item) => item.status === "completed");
  const failed = runResults.filter((item) => item.status === "failed");

  return {
    planned: runResults.length,
    completed: successful.length,
    failed: failed.length
  };
}

async function main() {
  const config = getConfig();
  const runPlan = buildRunPlan(config);

  console.log(
    `[session-harness] phase=${config.phase} runId=${config.runId} total=${config.total} concurrency=${config.concurrency} capture=${config.captureMode}`
  );

  await ensureCleanOutputDir();
  try {
    const initialForRun = await fetchFraudSessions(config.fraudSessionsApi, {
      testRunId: config.runId
    });

    const browser = await chromium.launch({ headless: config.headless });
    const startedAt = new Date().toISOString();
    let runResults = [];

    try {
      runResults = await runWithConcurrency(runPlan, config.concurrency, (item) =>
        runScenario(browser, config, item)
      );
    } finally {
      await browser.close();
    }

    const successfulCount = runResults.filter((item) => item.status === "completed").length;
    if (successfulCount > 0) {
      await waitForRunSessions(config.fraudSessionsApi, config.runId, successfulCount);
    }

    const runSessions = await fetchFraudSessions(config.fraudSessionsApi, {
      testRunId: config.runId
    });
    const totals = summarizeResults(runResults);
    const sessionDetails = runResults.map((result) => {
      const matchedSession = resolveSessionForRunItem(runSessions, result);
      const observedFlagged =
        matchedSession && matchedSession.summary.status !== "Normal";
      const expectedFlagged = result.target === "flagged";

      return {
        ...result,
        sessionId: matchedSession?.sessionId ?? null,
        score: matchedSession?.summary.currentRiskScore ?? null,
        statusLabel: matchedSession?.summary.status ?? null,
        topFlags: matchedSession?.summary.topFlags ?? [],
        reasonCodes: matchedSession?.summary.reasonCodes ?? [],
        observedFlagged:
          typeof observedFlagged === "boolean" ? observedFlagged : null,
        expectedFlagged,
        classification:
          typeof observedFlagged === "boolean"
            ? observedFlagged === expectedFlagged
              ? "match"
              : "mismatch"
            : "missing"
      };
    });

    const matchedClassifications = sessionDetails.filter(
      (item) => item.classification === "match"
    ).length;
    const mismatchedClassifications = sessionDetails.filter(
      (item) => item.classification === "mismatch"
    ).length;
    const missingClassifications = sessionDetails.filter(
      (item) => item.classification === "missing"
    ).length;
    const observedFlaggedCount = sessionDetails.filter(
      (item) => item.observedFlagged === true
    ).length;
    const observedUnflaggedCount = sessionDetails.filter(
      (item) => item.observedFlagged === false
    ).length;

    const report = {
      generatedAt: new Date().toISOString(),
      startedAt,
      runId: config.runId,
      phase: config.phase,
      config: {
        total: config.total,
        concurrency: config.concurrency,
        flaggedRatio: config.flaggedRatio,
        captureMode: config.captureMode,
        bankUrl: config.bankUrl,
        fraudSessionsApi: config.fraudSessionsApi,
        headless: config.headless
      },
      totalsBeforeRun: initialForRun.length,
      totalsAfterRun: runSessions.length,
      execution: totals,
      assertions: {
        matchedClassifications,
        mismatchedClassifications,
        missingClassifications,
        observedFlaggedCount,
        observedUnflaggedCount
      },
      sessions: sessionDetails
    };

    const reportPath = path.join(OUTPUT_DIR, "report.json");
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await fs.rm(TEMP_VIDEO_DIR, { recursive: true, force: true }).catch(() => null);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/* eslint-disable no-console */
const path = require("path");
const fs = require("fs/promises");
const { chromium } = require("playwright");

const BANK_URL = "http://localhost:3000";
const FRAUD_SESSIONS_API = "http://localhost:3001/api/fraud/sessions";

function timestampLabel() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const sec = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${sec}`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function waitFor(conditionFn, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const intervalMs = options.intervalMs ?? 600;
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

async function fetchFraudSessions() {
  const response = await fetch(FRAUD_SESSIONS_API, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load fraud sessions: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Fraud sessions endpoint returned non-array payload.");
  }

  return payload;
}

async function waitForNewSession(previousSessionIds, label) {
  return waitFor(async () => {
    const sessions = await fetchFraudSessions();
    const newest = sessions.find(
      (session) => !previousSessionIds.has(session.sessionId)
    );

    if (!newest) {
      return null;
    }

    return newest;
  }, {
    timeoutMs: 30_000,
    intervalMs: 1_000,
    message: `No new fraud session detected for ${label}.`
  });
}

async function enableMonitoring(page) {
  await page.goto(BANK_URL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Save preference" }).click();
  await page.waitForTimeout(600);
}

async function goToTransfer(page) {
  await page.locator('[data-telemetry-id="nav-transfer"]').first().click();
  await page.waitForURL("**/transfer");
  await page.waitForTimeout(400);
}

async function goToActivity(page) {
  await page.locator('[data-telemetry-id="nav-activity"]').first().click();
  await page.waitForURL("**/activity");
  await page.waitForTimeout(500);
}

async function submitTransfer(
  page,
  {
    amount,
    preReviewWaitMs,
    reviewWaitMs
  }
) {
  const amountInput = page.locator('input[data-telemetry-field="amount"]');
  await amountInput.click();
  await page.keyboard.type(amount, { delay: 8 });
  await page.waitForTimeout(preReviewWaitMs);

  const reviewButton = page.locator('[data-telemetry-id="transfer-review"]');
  await reviewButton.click();
  await page.waitForTimeout(reviewWaitMs);

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Submit Transfer" }).click();

  await waitFor(async () => {
    const text = await page.locator("text=Transfer complete").first().count();
    return text > 0 ? true : null;
  }, {
    timeoutMs: 10_000,
    intervalMs: 500,
    message: "Transfer success state did not appear."
  });
}

async function performZigZagMouse(page) {
  let x = 320;
  let y = 420;
  await page.mouse.move(x, y);

  for (let i = 0; i < 34; i += 1) {
    x += i % 2 === 0 ? 190 : -190;
    y += i % 4 < 2 ? 130 : -130;
    await page.mouse.move(x, y);
    await page.waitForTimeout(95);
  }
}

async function runScenario(browser, outputDir, scenarioName, scenarioFn) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 720 }
    }
  });
  const page = await context.newPage();
  const video = page.video();

  try {
    await scenarioFn(page);
    const screenshotPath = path.join(outputDir, `${scenarioName}-activity.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await context.close();

    const rawVideoPath = await video.path();
    const finalVideoPath = path.join(outputDir, `${scenarioName}.webm`);
    await fs.copyFile(rawVideoPath, finalVideoPath);

    return {
      screenshotPath,
      videoPath: finalVideoPath
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function nonFlaggedScenario(page) {
  await enableMonitoring(page);
  await page.waitForTimeout(2_000);

  await goToTransfer(page);
  await page.waitForTimeout(1_200);

  await submitTransfer(page, {
    amount: "10",
    preReviewWaitMs: 12_000,
    reviewWaitMs: 7_000
  });
  await page.waitForTimeout(1_100);

  await goToActivity(page);
}

async function flaggedScenario(page) {
  await enableMonitoring(page);
  await page.waitForTimeout(250);

  await page.locator('[data-telemetry-id="nav-accounts"]').first().click();
  await page.waitForTimeout(220);
  await page.locator('[data-telemetry-id="nav-transfer"]').first().click();
  await page.waitForTimeout(220);
  await page.locator('[data-telemetry-id="nav-activity"]').first().click();
  await page.waitForTimeout(220);
  await page.locator('[data-telemetry-id="nav-transfer"]').first().click();
  await page.waitForURL("**/transfer");

  for (let i = 0; i < 4; i += 1) {
    await page.locator('[data-telemetry-id="nav-transfer"]').first().click();
    await page.waitForTimeout(120);
  }

  await performZigZagMouse(page);

  const amountInput = page.locator('input[data-telemetry-field="amount"]');
  await amountInput.click();
  await page.keyboard.type("100000", { delay: 8 });
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(70);
  }

  const note = page.locator('textarea[data-telemetry-field="note"]');
  for (const value of ["a", "ab", "abc", "abcd"]) {
    await note.fill(value);
    await page.waitForTimeout(1_750);
  }

  const reviewButton = page.locator('[data-telemetry-id="transfer-review"]');
  await reviewButton.click();
  await page.waitForTimeout(900);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Submit Transfer" }).click();

  await waitFor(async () => {
    const text = await page.locator("text=Transfer complete").first().count();
    return text > 0 ? true : null;
  }, {
    timeoutMs: 12_000,
    intervalMs: 500,
    message: "Flagged transfer did not complete."
  });

  await page.waitForTimeout(1_000);
  await goToActivity(page);
}

async function main() {
  const runLabel = timestampLabel();
  const outputDir = path.join(
    process.cwd(),
    "artifacts",
    "session-simulations",
    runLabel
  );
  await ensureDir(outputDir);

  const browser = await chromium.launch({ headless: true });

  try {
    const initialSessions = await fetchFraudSessions();
    const seenSessionIds = new Set(initialSessions.map((session) => session.sessionId));

    const normalArtifacts = await runScenario(
      browser,
      outputDir,
      "01-non-flagged",
      nonFlaggedScenario
    );
    const nonFlaggedSession = await waitForNewSession(
      seenSessionIds,
      "non-flagged session"
    );
    seenSessionIds.add(nonFlaggedSession.sessionId);

    const flaggedArtifacts = await runScenario(
      browser,
      outputDir,
      "02-flagged",
      flaggedScenario
    );
    const flaggedSession = await waitForNewSession(
      seenSessionIds,
      "flagged session"
    );

    const report = {
      generatedAt: new Date().toISOString(),
      outputDir,
      nonFlagged: {
        sessionId: nonFlaggedSession.sessionId,
        score: nonFlaggedSession.summary.currentRiskScore,
        status: nonFlaggedSession.summary.status,
        topFlags: nonFlaggedSession.summary.topFlags,
        reasonCodes: nonFlaggedSession.summary.reasonCodes,
        videoPath: normalArtifacts.videoPath,
        activityScreenshotPath: normalArtifacts.screenshotPath
      },
      flagged: {
        sessionId: flaggedSession.sessionId,
        score: flaggedSession.summary.currentRiskScore,
        status: flaggedSession.summary.status,
        topFlags: flaggedSession.summary.topFlags,
        reasonCodes: flaggedSession.summary.reasonCodes,
        videoPath: flaggedArtifacts.videoPath,
        activityScreenshotPath: flaggedArtifacts.screenshotPath
      }
    };

    const reportPath = path.join(outputDir, "report.json");
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

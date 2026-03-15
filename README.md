# NorthMaple Bank + FraudShield

Monorepo for a two-app fraud detection project:

- `banker` (port `3000`): customer banking UI that emits behavioral telemetry.
- `fraudshield` (port `3001`): analyst dashboard that scores sessions, raises alerts, and tracks cases.

Built with `railtracks` support for batch validation orchestration.

## What The Project Demonstrates

- Real-time session risk scoring from behavioral + transaction signals.
- Rules-based scoring with optional AI co-assessment.
- Analyst workflow: live sessions, alerts, case queue, session drill-down.
- Deterministic concurrent validation harness (50-agent batch support).

## Repository Structure

```text
banker/
  app/...
  components/...
  lib/...
  testing/session-harness/
    simulate-session-batch.js
    README.md

fraudshield/
  app/...
  components/...
  lib/fraud/...

testing/railtracks/
  run_ab_validation.py
```

## Prerequisites

- Node.js 20+
- npm
- MongoDB reachable from both apps
- Python 3.10+ (only for Railtracks wrapper script)

## Install

```bash
cd banker
npm install

cd ../fraudshield
npm install

cd ..
pip install -r requirements.txt
```

## Environment

Create env files for both apps:

- `banker/.env` (or `.env.local`)
- `fraudshield/.env`

Minimum shared settings:

```env
MONGODB_URI=mongodb://localhost:27017/
MONGODB_DB=northmaple_bank_demo
```

FraudShield AI settings (optional but recommended):

```env
FRAUD_AI_ENABLED=true
FRAUD_AI_BASE_URL=https://qyt7893blb71b5d3.us-east-2.aws.endpoints.huggingface.cloud/v1
FRAUD_AI_MODEL=openai/gpt-oss-120b
# For hackathon shared endpoint, "test" works as placeholder unless organizer specifies otherwise:
FRAUD_AI_API_KEY=test
```

## Run Locally

Terminal 1:

```bash
cd banker
npm run dev
```

Terminal 2:

```bash
cd fraudshield
npm run dev
```

Open:

- Bank UI: `http://localhost:3000`
- Fraud dashboard: `http://localhost:3001/dashboard`

## 50-Agent Validation

From `banker/`:

```bash
node testing/session-harness/simulate-session-batch.js --phase=scale50 --capture=sample
```

Artifacts are written to:

- `banker/testing/session-harness/latest/report.json`
- `banker/testing/session-harness/latest/*.webm`
- `banker/testing/session-harness/latest/*-activity.png`

## Verify Uplift Metrics

Use run-scoped metrics for exact validation:

```bash
http://localhost:3001/api/fraud/metrics?testRunId=<runId-from-report>
```

Useful fields:

- `comparison.uplift.f1Delta`
- `comparison.uplift.precisionDelta`
- `comparison.uplift.falsePositiveRateDelta`
- `comparison.aiAssessedSessions`

## Railtracks Runner

From repo root:

```bash
python testing/railtracks/run_ab_validation.py --phase=scale50 --total=50 --concurrency=10
```

This wraps the Node harness and writes:

- `testing/railtracks/latest-ab-summary.json`


# NorthMaple Bank + FraudShield

NorthMaple Bank + FraudShield is a two-app fraud detection project built for real-time behavioral risk monitoring in online banking.

- `banker` (port `3000`): customer-facing banking app that emits behavioral telemetry during transfer flows.
- `fraudshield` (port `3001`): analyst dashboard that scores sessions, creates alerts/cases, and shows investigation context.

Built with `railtracks`.

## Project Inspiration

Traditional fraud checks are often transaction-only (amount limits, destination checks, velocity), which can miss session-level behavior that signals account takeover or automated abuse.  
This project was motivated by the idea that fraud can be detected earlier by combining:

- transaction context (amount, destination novelty, velocity), and
- interaction behavior (navigation patterns, correction bursts, hesitation timing, mouse movement signals).

The goal is to catch suspicious transfers in real time while still preserving a clean analyst workflow for triage and escalation.

## Technology Stack

### Languages

- TypeScript
- JavaScript
- Python
- CSS

### Frameworks and Libraries

- Next.js (App Router)
- React
- Tailwind CSS
- MongoDB Node.js Driver
- Playwright (concurrent behavioral harness)
- Zustand (bank app state)
- Railtracks (validation orchestration integration)

### Platforms

- MongoDB
- HuggingFace OpenAI-compatible inference endpoint for optional AI co-assessment (`gpt-oss-120b`)
- Localhost deployment for both apps (`3000` and `3001`)

### Tools

- Node.js / npm
- Git / GitHub
- Python + `pip`

## Product Summary

This project simulates a full fraud detection loop:

1. A user performs banking actions in the NorthMaple app, including transfer review and submit.
2. Behavioral telemetry is captured and sent to backend storage.
3. FraudShield scores each session using a rules pipeline and optional AI co-assessment.
4. Analysts get live session views, triggered alerts, and case queue actions.

Core features:

- Real-time risk scoring by session.
- Alert severity tiers (low/medium/high) with reason codes.
- Case generation and status workflow (`Open`, `Investigating`, `Resolved`).
- Session drill-down with event timeline and top risk factors.
- Concurrent validation harness (up to 50 agents) with run-level reporting.
- Run-scoped model comparison metrics (`rules-only` vs `rules+AI`) for precision/recall/F1 and false-positive deltas.

## AI Use

Survey answer: **Yes**. More than 70% of implementation and iteration work was AI-assisted.

## Repository Structure

```text
banker/
  app/
  components/
  lib/
  testing/session-harness/
    simulate-session-batch.js
    README.md

fraudshield/
  app/
  components/
  lib/fraud/

testing/railtracks/
  run_ab_validation.py
```

## Setup

### Prerequisites

- Node.js 20+
- npm
- Python 3.10+ (for Railtracks wrapper)
- MongoDB reachable by both apps

### Install

```bash
cd banker
npm install

cd ../fraudshield
npm install

cd ..
pip install -r requirements.txt
```

### Environment

Create:

- `banker/.env` (or `.env.local`)
- `fraudshield/.env`

Minimum shared settings:

```env
MONGODB_URI=mongodb://localhost:27017/
MONGODB_DB=northmaple_bank_demo
```

Optional FraudShield AI settings:

```env
FRAUD_AI_ENABLED=true
FRAUD_AI_BASE_URL=https://qyt7893blb71b5d3.us-east-2.aws.endpoints.huggingface.cloud/v1
FRAUD_AI_MODEL=openai/gpt-oss-120b
FRAUD_AI_API_KEY=test
```

## Run The Apps

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

## Validation And Testing

### 50-Agent Concurrent Validation

From `banker/`:

```bash
node testing/session-harness/simulate-session-batch.js --phase=scale50 --capture=sample
```

Artifacts (generated at runtime):

- `banker/testing/session-harness/latest/report.json`
- `banker/testing/session-harness/latest/*.webm`
- `banker/testing/session-harness/latest/*-activity.png`

### Verify Uplift For A Specific Run

Use run-scoped metrics:

```text
http://localhost:3001/api/fraud/metrics?testRunId=<runId-from-report>
```

Key fields:

- `comparison.uplift.f1Delta`
- `comparison.uplift.precisionDelta`
- `comparison.uplift.falsePositiveRateDelta`
- `comparison.aiAssessedSessions`

### Railtracks Runner

From repo root:

```bash
python testing/railtracks/run_ab_validation.py --phase=scale50 --total=50 --concurrency=10
```

Output:

- `testing/railtracks/latest-ab-summary.json`

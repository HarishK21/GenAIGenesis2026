# 🛡️ FraudShield + 🏦 NorthMaple Bank

Real-time fraud detection for online banking, powered by behavioral telemetry.

FraudShield combines classic transaction checks with session-level behavior signals to catch suspicious transfers earlier and give analysts clearer triage context.

Built with `railtracks`.

## 💡 Project Inspiration

Traditional fraud checks are often transaction-only (amount limits, destination checks, velocity). That leaves a gap: account takeover and automated abuse can look "normal" transaction-wise but still behave abnormally at the session level.

This project was motivated by the idea that fraud can be detected earlier by combining:
- transaction context (amount, destination novelty, velocity), and
- interaction behavior (navigation patterns, correction bursts, hesitation timing, mouse movement signals).

Why it matters in generative AI:
- AI can help interpret noisy, multi-signal behavior patterns and improve analyst decision support.
- Human analysts still stay in the loop with explainable factors, alerts, and case workflows.

## 🧱 Technology Stack

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
- Railtracks (validation orchestration)

### Platforms
- MongoDB
- HuggingFace OpenAI-compatible inference endpoint (optional AI co-assessment with `gpt-oss-120b`)
- Localhost deployment for both apps (`3000` and `3001`)

### Tools
- Node.js / npm
- Python / pip
- Git / GitHub

## 🚀 Product Summary

FraudShield simulates a full fraud detection loop:
1. A user performs banking actions in the `banker` app.
2. Behavioral telemetry is captured and persisted.
3. `fraudshield` scores sessions using rules and optional AI co-assessment.
4. Analysts review live sessions, alerts, and cases.

Core features:
- Real-time risk scoring by session
- Alert severity tiers (`Low`, `Medium`, `High`) with reason codes
- Case workflow (`Open`, `Investigating`, `Resolved`)
- Session drill-down with event timeline and top risk factors
- Concurrent validation harness (up to 50 agents)
- Run-scoped model comparison (`rules-only` vs `rules+AI`) for precision/recall/F1 and false-positive deltas

Innovative angle:
- It blends transaction risk + behavior signals in one pipeline.
- It supports explainable analyst workflows instead of black-box-only scoring.

## 🧭 Two Apps, One Flow

| App | Port | Role |
| --- | --- | --- |
| `banker` | `3000` | Synthetic banking client that generates transfer sessions + telemetry |
| `fraudshield` | `3001` | Analyst dashboard for scoring, alerts, and case workflow |

## 📂 Repository Structure

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

## ⚙️ Setup

### Prerequisites
- Node.js 20+
- npm
- Python 3.10+
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

## ▶️ Run Locally

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
- Fraud Dashboard: `http://localhost:3001/dashboard`

## 🧪 Validation and Testing

### 50-Agent Concurrent Validation

From `banker/`:

```bash
node testing/session-harness/simulate-session-batch.js --phase=scale50 --capture=sample
```

Artifacts generated at runtime:
- `banker/testing/session-harness/latest/report.json`
- `banker/testing/session-harness/latest/*.webm`
- `banker/testing/session-harness/latest/*-activity.png`

### Verify Uplift for a Specific Run

Use:

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

## 🤖 AI Use

Survey answer: **Yes**. More than 70% of implementation and iteration work was AI-assisted.

---

For live presentations, use `DEMO_SCRIPT.md` for a ready-to-read screenshare script 🎤

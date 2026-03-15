# Session Harness

Runs authenticated bank UI sessions with deterministic users, run/agent/scenario tags, and writes one canonical artifact batch in-repo.
Transfer amounts are varied per session (not fixed at `$10`) while staying below unusual-amount thresholds.
Flagged scenarios are intentionally mixed so alerts include High + Medium severities and non-erratic reasons:
- `flagged-erratic-nav` (high severity path)
- `flagged-cognitive-drift` (high severity, hesitation/correction pattern)
- `flagged-review-corrections` (medium severity tendency, correction-heavy review flow)

## Run

```bash
# 4 sessions, 2-way concurrency, captures 2 flagged + 2 unflagged artifacts
node testing/session-harness/simulate-session-batch.js --phase=smoke

# 20 sessions for ramp testing
node testing/session-harness/simulate-session-batch.js --phase=ramp

# 50 concurrent-agent scale test
node testing/session-harness/simulate-session-batch.js --phase=scale50
```

## Useful Overrides

```bash
node testing/session-harness/simulate-session-batch.js \
  --phase=scale50 \
  --total=50 \
  --concurrency=10 \
  --capture=sample \
  --runId=run-20260314-2200
```

- `--capture=none|sample|all`
- `--headless=true|false`
- `--flaggedRatio=0.4` (portion of sessions that target flagged behavior)
- `--bankUrl=http://localhost:3000`
- `--fraudUrl=http://localhost:3001/api/fraud/sessions`
- `--fraudMetricsUrl=http://localhost:3001/api/fraud/metrics`
- `--fraudFeedbackUrl=http://localhost:3001/api/fraud/feedback`
- `--autoLabel=true|false` (default `true`, writes synthetic analyst outcomes)
  - Review-correction scenarios are deterministically split between legit/fraud outcomes to stress test precision/recall tradeoffs.

## Output

Single canonical output folder:

- `testing/session-harness/latest/report.json`
- `testing/session-harness/latest/*.webm`
- `testing/session-harness/latest/*-activity.png`

These artifacts are generated per run and intentionally not committed to source control.

`report.json` also includes `monitoring.modelComparison` when the FraudShield metrics
API is reachable, with rules-only vs rules+AI precision/recall/F1 deltas and added latency.

# NorthMaple Bank Demo

NorthMaple Bank is a fictional online banking sandbox for a hackathon fraud-detection demo. The interface is intentionally simple, clearly labeled as synthetic, and designed to feel bank-like without copying any real institution's branding or login flow.

## Stack

- Next.js 14 with the App Router
- TypeScript
- Tailwind CSS
- MongoDB Atlas with the official `mongodb` driver
- Local shadcn-style UI primitives for cards, buttons, inputs, dialog, and switch
- Zustand for front-end client state hydrated from MongoDB

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create `.env.local` with:

```bash
MONGODB_URI=your-atlas-connection-string
MONGODB_DB=northmaple_bank_demo
NEXT_PUBLIC_TELEMETRY_ENDPOINT=/api/telemetry
```

## What the prototype includes

- Home dashboard with greeting, account summary, quick actions, and recent activity
- Accounts page with two synthetic accounts only: chequing and savings
- Transfer page with review and submit actions
- Activity page with simple front-end filtering
- Consent banner for fraud protection monitoring
- MongoDB-backed storage for the demo user, accounts, transactions, and telemetry
- Telemetry batching plus a Mongo-persisted `/api/telemetry` ingest route

## Fraud monitoring signals tracked

The telemetry module tracks only demo-safe behavior summaries after the user opts in:

- `sessionId`
- page name and timestamps
- page dwell time
- time before first click
- click sequence across major tagged UI elements
- high-level mouse travel distance and area transitions
- rapid repeated clicks
- sudden navigation changes
- field focus changes
- typing-speed summary
- correction and backspace counts
- hesitation counts before submit
- transfer amount
- unusual-amount flag relative to the current session baseline
- review-to-submit delay

The app does **not** capture passwords, raw credentials, or the full contents of free-text notes. For text inputs, only metadata summaries such as note length, typing cadence, and correction count are sent.

## Why these signals matter

- Dwell time and first-click timing can help spot rushed or scripted behavior.
- Click sequences and rapid navigation can highlight unfamiliar or erratic journeys.
- Mouse distance and sharp direction changes can suggest unusual interaction patterns.
- Typing speed, backspaces, and hesitations can reveal uncertainty or copy/paste-like behavior.
- Transfer amount and unusual-amount flags help the fraud dashboard compare the action against the current session's baseline.
- Review-to-submit delay can separate careful review behavior from immediate submission.

## Connecting to the fraud-analysis dashboard

By default, telemetry batches post to the local app route:

```text
/api/telemetry
```

To send directly to a separate fraud-analysis service, set:

```bash
NEXT_PUBLIC_TELEMETRY_ENDPOINT=http://localhost:5001/ingest
```

`lib/telemetry.tsx` is the single place where the banking UI forwards synthetic behavior events. The sender is wrapped in `try/catch`, fails silently, and logs to the console in development so the banking demo continues to work even if the fraud dashboard is offline.

## MongoDB data model

The demo seeds and stores these collections:

- `users`: the fictional NorthMaple customer profile
- `accounts`: chequing and savings balances
- `transactions`: synthetic deposits, withdrawals, and transfers
- `telemetry_events`: raw demo-safe telemetry events
- `telemetry_sessions`: derived session summaries captured on transfer submit

The banking UI fetches its snapshot from `/api/bank/state`, and transfer submissions persist through `/api/bank/transfer`.

## Project structure

```text
app/
  (bank)/
    page.tsx
    accounts/page.tsx
    transfer/page.tsx
    activity/page.tsx
  api/telemetry/route.ts
components/
  consent-banner.tsx
  dashboard/
  layout/
  ui/
lib/
  bank-store.ts
  demo-data.ts
  formatters.ts
  telemetry.tsx
  types.ts
```

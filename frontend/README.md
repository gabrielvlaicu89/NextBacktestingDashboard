# Frontend

Next.js 16 frontend for the Trading Backtesting Platform.

It is responsible for:

- Google authentication via NextAuth
- strategy builder and workspace UI
- a dedicated custom strategy draft page at `/dashboard/build-custom-stratergy`
- proxying backtest and optimization requests to the FastAPI backend
- persisting strategies and run metadata through Prisma
- persisting saved custom strategy definitions through Prisma for the in-progress custom builder flow

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL database
- FastAPI backend running on port 8000
- Google OAuth credentials for localhost sign-in

## Environment Setup

Copy the example file and fill in your local values:

```bash
cp .env.example .env.local
```

Minimum variables required for a useful local run:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/backtester"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/backtester"
NEXTAUTH_SECRET="replace-with-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
BACKEND_URL="http://localhost:8000"
```

Notes:

- `DATABASE_URL` and `DIRECT_URL` can both point to local Postgres for development.
- `prisma.config.ts` loads `.env.local`, so Prisma CLI commands use the same values as Next.js.
- Dashboard routes are protected, so login must work if you want to test the full app.

## Local Run: Manual

### 1. Start PostgreSQL and backend

From the repo root:

```bash
docker compose up -d db
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend health check should respond at `http://localhost:8000/health`.

### 2. Apply Prisma migrations

From `frontend/`:

```bash
npm install
npx prisma migrate deploy
```

If you are actively changing schema during development, use `npx prisma migrate dev` instead.

Custom strategy persistence note:

- The frontend now includes a `CustomStrategyDefinition` Prisma model for storing saved custom strategy drafts independently from built-in backtest strategies.
- Saved custom definitions currently use a draft-safe schema, so incomplete rule trees can be saved and reopened before execution support exists.
- The dedicated custom builder page now includes a searchable local indicator catalog with add/remove flows and parameter editors for saved drafts.
- The dedicated custom builder page now also includes nested rule editors for long and short entry and exit conditions using price, indicator, and constant operands.
- The custom builder now shows inline rule validation errors and a save-time validation summary when a draft contains malformed rule operands or broken indicator references.
- The custom builder now also blocks saving any started nested group that is still empty, while keeping untouched top-level rule sections draft-safe.
- The custom builder route now includes a dedicated loading skeleton and route-level error boundary for failed draft loading.
- The `+ New Backtest` page now lists saved custom strategy drafts, lets users load one into launcher runtime review mode, and still links into the dedicated custom builder page for editing.
- Launcher-side custom runtime review now supports running saved custom strategies through the backend when they use long-entry and long-exit rules only.
- Custom duplication from the workspace now restores the saved runtime fields as well as the definition snapshot before returning to the launcher.
- Custom launcher runs now reuse the shared ticker/date/benchmark/risk validation path before any request is sent.
- Short-entry and short-exit custom rules are still draftable but are blocked at runtime until the execution engine supports short lifecycle handling.
- After pulling schema changes, run Prisma migrations before starting the app so the custom definition table exists locally.

If the generated Prisma client gets out of sync after schema changes, run:

```bash
npx prisma generate
```

### 3. Start Next.js

```bash
npm run dev
```

Open `http://localhost:3000`.

## Local Run: Full Stack with Docker Compose

From the repo root:

```bash
docker compose up --build
```

This now starts:

- PostgreSQL on `localhost:5432`
- FastAPI on `localhost:8000`
- Next.js on `localhost:3000`

The frontend container installs dependencies, runs Prisma migrations against the local Postgres container, and starts `next dev`.

Before using this flow, create `frontend/.env.local` from `frontend/.env.example` so the container has your auth secrets and OAuth credentials available.

## Google OAuth Setup for Localhost

In Google Cloud Console, add this callback URL to your OAuth client:

```text
http://localhost:3000/api/auth/callback/google
```

Without valid Google OAuth credentials:

- the public landing page will still load
- protected `/dashboard/*` routes will redirect to login
- full authenticated smoke testing will be blocked

## Recommended Smoke Test Checklist

After startup, verify these flows in order:

1. Load `http://localhost:3000`
2. Sign in with Google
3. Confirm `/dashboard` loads successfully
4. Create a simple Buy & Hold or Mean Reversion backtest on `SPY`
5. Confirm SSE progress updates appear during the run
6. Confirm the results page renders metrics, charts, and trade log
7. Save the run as an experiment
8. Reload the workspace and confirm the saved strategy persists
9. Run an optimization and confirm progressive results stream in

Custom strategy draft smoke test:

1. Open `/dashboard/build-custom-stratergy`
2. Search the indicator library and add at least one indicator, then adjust one indicator parameter
3. Add at least one long-entry or exit rule, then create a nested subgroup and place a condition inside it
4. Add another nested subgroup and leave it empty, then confirm the builder blocks saving until that empty group is removed or completed
5. Switch one rule operand to `Indicator` without selecting a valid indicator and confirm inline validation appears and save is blocked
6. Restore the rule tree to a valid state, create a draft name and description, then save
7. Refresh the page and confirm the saved draft can be reopened with the same indicators and nested rules
8. Open `+ New Backtest` and confirm the saved custom strategy appears in the launcher section
9. Use `Review Runtime Config` and confirm the launcher switches into custom runtime review mode for that saved draft
10. Run a long-only custom draft and confirm the backtest starts successfully
11. Clear the ticker or invert the date range in launcher runtime review mode and confirm inline validation appears before any request is sent
12. Add a short-entry or short-exit rule to a draft, return to the launcher, and confirm runtime blocking appears before the request is sent
13. Duplicate a saved custom strategy from the workspace and confirm ticker, date range, benchmark, risk settings, tags, and the definition snapshot are all restored in the launcher
14. Use the edit link and confirm it loads the same saved draft on the dedicated builder page
15. Temporarily break the custom strategy definition fetch and confirm the page shows the custom builder retry state instead of a blank editor

## Useful Commands

```bash
# Start frontend dev server
npm run dev

# Build production bundle
npm run build

# Start production server after build
npm run start

# Run frontend tests
npm run test

# Regenerate Prisma client after schema changes
npx prisma generate

# Run eslint
npm run lint
```

## Troubleshooting

### Prisma cannot connect to the database

Check that Postgres is running and that `DATABASE_URL` / `DIRECT_URL` point to the correct host.

For local Docker Postgres, the host should usually be:

- `localhost` when running Next.js on your machine
- `db` when running Next.js inside Docker Compose

### Backtest requests fail immediately

Check `BACKEND_URL` and verify the backend responds at:

```text
http://localhost:8000/health
```

### Login works but dashboard stays inaccessible

Check:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- Google OAuth callback configuration
- Prisma database connectivity

# Frontend

Next.js 16 frontend for the Trading Backtesting Platform.

It is responsible for:

- Google authentication via NextAuth
- strategy builder and workspace UI
- proxying backtest and optimization requests to the FastAPI backend
- persisting strategies and run metadata through Prisma

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

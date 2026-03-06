# GitHub Copilot Instructions

## Project Overview

This is a **Trading Backtesting Platform** — a full-stack monorepo with a Next.js 15 frontend and FastAPI backend, allowing users to build, run, and compare algorithmic trading strategies.

---

## Repository Structure

```
/
├── frontend/          # Next.js 15 App Router (TypeScript)
│   ├── app/           # App Router pages and API routes
│   ├── components/    # shadcn/ui + custom React components
│   ├── store/         # Redux Toolkit slices and store
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities, server actions, auth helpers
│   └── prisma/        # Prisma schema and migrations
├── backend/           # FastAPI (Python)
│   └── app/
│       ├── engine/    # Strategy implementations (base + 5 strategies)
│       ├── routers/   # FastAPI route handlers
│       ├── services/  # Data fetching, metrics, optimizer
│       └── models/    # Pydantic schemas
└── .github/           # GitHub config (workflows, templates, Copilot)
```

---

## Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router, Server Components, Server Actions)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui component library
- **State:** Redux Toolkit (`store/slices/`)
- **Auth:** NextAuth.js v5 with Google OAuth + `@auth/prisma-adapter`
- **ORM:** Prisma with Supabase (PostgreSQL)
- **Charts:** Lightweight Charts (equity/drawdown), Recharts (histograms)
- **Forms:** react-hook-form + zod validation
- **Path aliases:** `@/components`, `@/lib`, `@/store`, `@/hooks`

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Data:** yfinance for OHLCV data, Alpha Vantage for earnings/EPS
- **Streaming:** Server-Sent Events (SSE) for backtest/optimization progress
- **Validation:** Pydantic v2

### Infrastructure
- **Local dev:** Docker Compose (PostgreSQL + FastAPI)
- **Backend deploy:** Render
- **Frontend deploy:** Vercel

---

## Coding Conventions

### TypeScript / Next.js

- Use **Server Components** by default; add `"use client"` only when needed (event handlers, hooks, browser APIs)
- Use **Server Actions** (`lib/actions/`) for mutations — no separate API fetch wrappers for form submissions
- All Next.js API routes live in `app/api/` and act as a **proxy layer** to the FastAPI backend
- Redux is used for **client-side transient state** (form draft, backtest progress, comparison selections); server state is fetched via Server Components or React Query
- Use **zod** schemas for all form and API payload validation
- Prefer named exports over default exports for components
- Component files: PascalCase (`TickerSearch.tsx`); utility files: camelCase (`formatDate.ts`)
- Always type props explicitly — no implicit `any`

### Python / FastAPI

- Follow **PEP 8**; use type hints everywhere
- Strategy classes extend `engine/base.py`'s abstract `Strategy` class
- All strategies must implement `generate_signals(df)` and `execute_trades(df, capital)`
- Use Pydantic v2 models in `models/schemas.py` for all request/response shapes
- Services (`data_fetcher.py`, `metrics.py`, `optimizer.py`) are stateless functions or classes — no global mutable state
- SSE endpoints yield JSON-encoded event strings: `data: {"type": "progress", "percent": 42}\n\n`
- Raise `HTTPException` with appropriate status codes; never swallow exceptions silently

### General

- Never commit secrets or API keys — always use environment variables
- Env files: `.env.local` (frontend), `.env` (backend) — both are gitignored
- All `.env.example` files must stay up-to-date when new variables are added

---

## Key Files Reference

| File | Purpose |
|---|---|
| `frontend/lib/auth.ts` | `getServerSession()` helper + auth config |
| `frontend/proxy.ts` | Protect `/dashboard/*` routes (Next.js 16 renamed `middleware.ts` → `proxy.ts`) |
| `frontend/store/store.ts` | Redux store configuration |
| `frontend/prisma/schema.prisma` | DB models: User, Account, Session, Strategy, BacktestRun |
| `backend/app/engine/base.py` | Abstract `Strategy` base class |
| `backend/app/services/metrics.py` | Sharpe, drawdown, win rate, etc. |
| `backend/app/services/optimizer.py` | Grid search over param combinations |
| `backend/app/routers/backtest.py` | `/api/backtest/run` + SSE stream endpoints |

---

## Strategy Engine

Five strategies are implemented, all extending `engine/base.py`:

1. **Mean Reversion** (`mean_reversion.py`) — Z-score over rolling window
2. **MA Crossover** (`ma_crossover.py`) — Fast/slow SMA or EMA crossover
3. **Earnings Drift / PEAD** (`earnings_drift.py`) — Trade around earnings surprises
4. **Pairs Trading** (`pairs_trading.py`) — Spread mean-reversion on correlated pairs
5. **Buy & Hold** (`buy_and_hold.py`) — Benchmark baseline

---

## Common Patterns

### Adding a new frontend page
```
app/dashboard/<route>/page.tsx      # Server Component — fetch data here
app/dashboard/<route>/loading.tsx   # Skeleton loading state
app/dashboard/<route>/error.tsx     # Error boundary
```

### Adding a new API route (proxy)
```typescript
// app/api/<resource>/route.ts
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // proxy to FastAPI...
}
```

### Adding a new strategy
1. Create `backend/app/engine/<name>.py` extending `Strategy`
2. Add parameter schema to `backend/app/models/schemas.py`
3. Register in `backend/app/routers/strategies.py`
4. Add zod param schema + form fields in frontend `StrategyParamsForm`

### Adding a new Redux slice
```typescript
// store/slices/<name>Slice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
```
Then register in `store/store.ts`.

---

## Environment Variables

### Frontend (`frontend/.env.local`)
```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BACKEND_URL=http://localhost:8000
```

### Backend (`backend/.env`)
```
ALPHA_VANTAGE_API_KEY=
```

---

## Do's and Don'ts

**Do:**
- Use `getServerSession()` in Server Components and API routes to check auth
- Validate all user input with zod (frontend) and Pydantic (backend)
- Keep SSE events structured: `{ "type": "progress|complete|error", ... }`
- Write tests for all strategy implementations with synthetic OHLCV data

**Don't:**
- Don't fetch data in Client Components when a Server Component can do it
- Don't store sensitive data (tokens, API keys) in Redux state
- Don't add new Python dependencies without updating `requirements.txt`
- Don't add new npm packages without justification in the PR description
- Don't use `any` in TypeScript — use proper types or `unknown`

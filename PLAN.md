# Build Plan — Trading Backtesting Platform

**Stack:** Next.js 15 · shadcn/ui · Tailwind CSS · Redux Toolkit · Lightweight Charts · NextAuth (Google) · Prisma · Supabase · FastAPI · Render · Vercel

---

## Phase 1 — Project Scaffolding & Infra

- [x] **1. Initialize monorepo structure**
  - [x] Create `/frontend` and `/backend` directories at repo root
  - [x] Add root-level `.gitignore` (Node, Python, env files)
  - [x] Add `docker-compose.yml` for local dev (Postgres + FastAPI)
  - [x] Initialize git repo

- [x] **2. Scaffold Next.js 15 frontend**
  - [x] `npx create-next-app@latest frontend` (App Router, TypeScript, Tailwind, ESLint)
  - [x] Install and init shadcn/ui (`npx shadcn@latest init -d`)
  - [x] Install dependencies: `next-auth`, `@reduxjs/toolkit`, `react-redux`, `lightweight-charts`, `recharts`, `prisma`, `@prisma/client`, `zod`, `date-fns`, `next-themes`, `react-hook-form`, `@hookform/resolvers`
  - [x] Configure `tsconfig.json` path aliases (`@/components`, `@/lib`, `@/store`, `@/hooks`)

- [x] **3. Scaffold FastAPI backend**
  - [x] Create `requirements.txt` with all backend dependencies
  - [x] Create full backend project structure (`main.py`, routers, engine, services, models, tests)
  - [x] Add `Dockerfile` for backend

- [x] **4. Set up Supabase + Prisma**
  - [x] Create Supabase project and copy connection string
  - [x] `npx prisma init` in `/frontend`
  - [x] Define `prisma/schema.prisma` with all models (User, Account, Session, Strategy, BacktestRun)
  - [x] `npx prisma migrate dev` to create tables
  - [x] `npx prisma generate` to generate client

- [x] **5. Configure environment variables**
  - [x] `/frontend/.env.local`: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKEND_URL`
  - [x] `/frontend/.env.example` with documented placeholders
  - [x] `/backend/.env`: `ALPHA_VANTAGE_API_KEY`
  - [x] `/backend/.env.example` with documented placeholders
  - [x] All `.env` files covered by root `.gitignore`

---

## Phase 2 — Authentication ✅

- [x] **6. Set up NextAuth.js with Google provider**
  - [x] Create `app/api/auth/[...nextauth]/route.ts`
  - [x] Configure Google OAuth provider
  - [x] Install and wire up `@next-auth/prisma-adapter` (v4 adapter)
  - [x] Create `lib/auth.ts` with `getServerSession` helper + `authOptions`
  - [x] Create `lib/prisma.ts` PrismaClient singleton
  - [x] Create `types/next-auth.d.ts` — extend Session with `user.id`
  - [x] Create `components/providers/session-provider.tsx` — client SessionProvider wrapper
  - [x] Create `proxy.ts` to protect `/dashboard/*` routes (Next.js 16: renamed from `middleware.ts`)
  - [x] Fill in `.env.local` credentials
  - [x] Run `npx prisma migrate dev` + `npx prisma generate`

- [x] **7. Build auth pages**
  - [x] `app/(auth)/login/page.tsx` — "Sign in with Google" button (via `LoginCard` client component)
  - [x] `app/(auth)/layout.tsx` — minimal centered card layout
  - [x] `components/auth/login-card.tsx` — Google OAuth button with inline SVG logo
  - [x] Redirect authenticated users from `/` and `/login` → `/dashboard`
  - [x] `app/dashboard/page.tsx` — placeholder dashboard (Phase 5 will replace this)
  - [x] Root `app/layout.tsx` updated — wraps app with `SessionProvider` (session pre-fetched server-side)

---

## Phase 3 — Python Backtesting Engine ✅

- [x] **8. Build the data fetching layer**
  - [x] `services/data_fetcher.py`: `yfinance.download()` wrapper returning clean OHLCV DataFrames
  - [x] Handle ticker validation, date range checks, missing data
  - [x] In-memory caching to avoid redundant fetches during optimization (`lru_cache`)
  - [x] Alpha Vantage client for earnings/EPS data (`fetch_earnings` via httpx)

- [x] **9. Build the abstract strategy engine**
  - [x] `engine/base.py`: abstract `Strategy` class with:
    - [x] `generate_signals(df) -> DataFrame` — adds `signal` column (+1 buy, -1 sell, 0 hold)
    - [x] `execute_trades(df, capital) -> list[Trade]` — simulates portfolio with stop-loss/take-profit
  - [x] `Trade` dataclass: entry_date, exit_date, entry_price, exit_price, pnl, pnl_pct, holding_days, exit_reason

- [x] **10. Implement all 5 strategies**
  - [x] **Mean Reversion** — Z-score over rolling window; buy Z < -threshold, sell Z > +threshold or after holding period
  - [x] **MA Crossover** — Fast/slow SMA or EMA; buy golden cross, sell death cross
  - [x] **Earnings Drift (PEAD)** — Trade around earnings dates; filter by EPS surprise threshold; Alpha Vantage data injected by router
  - [x] **Pairs Trading** — Two-ticker spread; OLS hedge ratio; long-only on spread dip; router injects ticker B data
  - [x] **Buy & Hold** — Enter day 1, exit last day; pure benchmark

- [x] **11. Build the metrics calculator**
  - [x] `services/metrics.py` computing from trade list + equity curve:
    - [x] Total Return %, Annualized Return %
    - [x] Max Drawdown % (+ drawdown time series for charting)
    - [x] Sharpe Ratio, Sortino Ratio
    - [x] Win Rate %, Profit Factor
    - [x] Monthly returns matrix (for heatmap)

- [x] **12. Build the grid search optimizer**
  - [x] `services/optimizer.py`: generate all param combinations via `itertools.product`
  - [x] Run each combination through backtest engine
  - [x] Return results matrix (param combos → metric values) for heatmap rendering
  - [x] Yield SSE progress events (% complete, current params)
  - [x] Strategy-specific pre-fetching (earnings data, pairs ticker B)

- [x] **13. Build FastAPI endpoints**
  - [x] `POST /api/backtest/run` — accepts strategy config, runs backtest, streams results via SSE
  - [x] `GET /api/tickers/search?q={query}` — Yahoo Finance ticker autocomplete proxy
  - [x] `GET /api/strategies/types` — returns strategy types + parameter schemas (for dynamic form)
  - [x] `POST /api/backtest/optimize` — triggers grid search, streams progress via SSE
  - [x] CORS middleware configured for Next.js frontend origin
  - [x] Global error handling (SSE error events with structured JSON)
  - [x] `GET /health` — health check endpoint
  - [x] `dotenv` loading for `ALPHA_VANTAGE_API_KEY`

- [x] **14. Write backend tests**
  - [x] Unit tests for each strategy with synthetic data (buy_and_hold, mean_reversion, ma_crossover, earnings_drift, pairs_trading)
  - [x] Unit tests for metrics calculations (verify against hand-computed values)
  - [x] Integration test: full backtest run via FastAPI TestClient (mocked data fetcher)

---

## Phase 4 — Next.js API Layer & Data Flow

- [ ] **15. Create Next.js API routes (proxy layer)**
  - [ ] `app/api/backtest/route.ts` — calls FastAPI, stores results in Prisma, returns to client
  - [ ] `app/api/tickers/route.ts` — proxies ticker search to FastAPI
  - [ ] `app/api/strategies/route.ts` — CRUD (GET list, POST create, PATCH update, DELETE)
  - [ ] `app/api/strategies/[id]/route.ts` — GET single strategy + its backtest runs

- [ ] **16. Set up Redux Toolkit store**
  - [ ] `store/store.ts` — configure store
  - [ ] `store/slices/strategyBuilderSlice.ts` — form state (ticker, dates, type, params, risk settings, benchmark)
  - [ ] `store/slices/backtestSlice.ts` — run status, progress %, results
  - [ ] `store/slices/comparisonSlice.ts` — selected strategy IDs, comparison results
  - [ ] `store/slices/workspaceSlice.ts` — saved strategies list, filters, sort order
  - [ ] `store/provider.tsx` — Redux Provider wrapper
  - [ ] Wrap root layout with provider

- [ ] **17. Create data fetching hooks & server actions**
  - [ ] `lib/actions/backtest.ts` — server action to trigger backtest
  - [ ] `lib/actions/strategies.ts` — server actions for strategy CRUD
  - [ ] `hooks/useBacktestStream.ts` — `EventSource` hook, parses SSE events, dispatches to Redux
  - [ ] `hooks/useTickerSearch.ts` — debounced search hook for ticker autocomplete

---

## Phase 5 — Frontend UI — Layout & Shell

- [ ] **18. Build the app shell and layout**
  - [ ] `app/layout.tsx` — root layout with Redux Provider, NextAuth SessionProvider, global styles, font
  - [ ] `app/dashboard/layout.tsx` — sidebar layout (Logo, nav items, user avatar + sign out)
  - [ ] Dark mode support via `next-themes`

- [ ] **19. Build the landing/login page**
  - [ ] `app/page.tsx` — public landing with hero section
  - [ ] `app/(auth)/login/page.tsx` — "Sign in with Google" card

---

## Phase 6 — Frontend UI — Strategy Builder

- [ ] **20. Build the Strategy Builder page**
  - [ ] `app/dashboard/new/page.tsx` — main form page
  - [ ] `TickerSearch` component — shadcn `Command` combobox with debounced search
  - [ ] `DateRangePicker` component — shadcn `Calendar` + `Popover`
  - [ ] `StrategyTypeSelector` component — `Select` or card-based picker
  - [ ] `StrategyParamsForm` component — dynamic fields per strategy type, validated via zod:
    - [ ] Mean Reversion: Z-score window, threshold, holding period
    - [ ] MA Crossover: fast period, slow period, MA type (SMA/EMA)
    - [ ] PEAD: days before, days after, EPS surprise threshold
    - [ ] Pairs Trading: second ticker, correlation window, spread threshold
    - [ ] Buy & Hold: no params
  - [ ] `RiskSettingsForm` component — capital, position sizing mode/size, stop-loss %, take-profit %
  - [ ] `BenchmarkSelector` component — ticker search, defaulting to SPY
  - [ ] `RunButton` — validates form, dispatches to Redux, triggers server action

- [ ] **21. Build the onboarding modal**
  - [ ] Show for first-time users (0 saved strategies)
  - [ ] Strategy template cards (e.g., "SPY Mean Reversion 2020–2024", "AAPL MA Crossover")
  - [ ] Clicking a template pre-fills the Strategy Builder

---

## Phase 7 — Frontend UI — Results Dashboard

- [ ] **22. Build the results page shell**
  - [ ] `app/dashboard/results/[id]/page.tsx` — fetches backtest run by ID
  - [ ] Loading state: progress bar + status text from SSE stream while backtest runs

- [ ] **23. Build Performance Cards row**
  - [ ] 7 metric cards: Total Return %, Annualized Return %, Max Drawdown %, Sharpe Ratio, Sortino Ratio, Win Rate %, Profit Factor
  - [ ] Color-coded: green (positive), red (negative)

- [ ] **24. Build the Equity Curve chart**
  - [ ] Lightweight Charts `LineSeries` for portfolio value over time
  - [ ] Overlay benchmark line in contrasting color
  - [ ] Crosshair with tooltip, responsive container

- [ ] **25. Build the Drawdown Chart**
  - [ ] Lightweight Charts `AreaSeries` — red-filled area below zero
  - [ ] Synced time axis with equity curve

- [ ] **26. Build the Monthly Returns Heatmap**
  - [ ] Custom grid component (months × years)
  - [ ] Green/red color gradient based on return value
  - [ ] Tooltip with exact % on hover

- [ ] **27. Build the Trade Distribution histogram**
  - [ ] Recharts `BarChart` — P&L buckets on X-axis, frequency on Y-axis
  - [ ] Green bars for profit buckets, red for loss

- [ ] **28. Build the Trade Log Table**
  - [ ] shadcn `DataTable` (TanStack Table) with columns: Entry Date, Exit Date, Entry Price, Exit Price, P&L ($), P&L (%), Holding Days, Exit Reason
  - [ ] Sortable columns, pagination, color-coded P&L

- [ ] **29. Add "Save as Experiment" flow**
  - [ ] shadcn `Dialog` with name input + tag input
  - [ ] Server action to create/update Strategy + BacktestRun records

---

## Phase 8 — Frontend UI — Workspace Dashboard

- [ ] **30. Build the Workspace page**
  - [ ] `app/dashboard/page.tsx` — strategy cards/table with key metrics + tags
  - [ ] Sort controls (Sharpe, total return, date)
  - [ ] Filter controls (strategy type, tags)
  - [ ] Per-card actions: View Results, Duplicate, Delete, checkbox for comparison
  - [ ] "New Backtest" CTA button

- [ ] **31. Build the "Duplicate" flow**
  - [ ] Copy strategy params into Redux store on "Duplicate" click
  - [ ] Navigate to `/dashboard/new` with Strategy Builder pre-filled

---

## Phase 9 — Frontend UI — Comparison & Optimization

- [ ] **32. Build the Strategy Comparison page**
  - [ ] `app/dashboard/compare/page.tsx` — accepts `?ids=1,2,3` query params
  - [ ] Comparison metrics table (rows = metrics, columns = strategies, highlight best value per row)
  - [ ] Overlaid equity curves on a single Lightweight Charts instance (different colors per strategy)
  - [ ] Legend with strategy names + colors

- [ ] **33. Build the Parameter Optimization page**
  - [ ] `app/dashboard/optimize/[id]/page.tsx`
  - [ ] Config form: min/max/step for each tunable param + metric to optimize for
  - [ ] SSE progress indicator (current combo, % complete)
  - [ ] Results heatmap (2 params → 2D color grid; 1 param → line chart; 3+ params → sortable table)
  - [ ] Click cell/point → navigate to that run's full results

---

## Phase 10 — Real-Time Streaming (SSE)

- [ ] **34. Implement SSE for backtest progress**
  - [ ] FastAPI: `text/event-stream` endpoint yielding progress JSON events
  - [ ] Event types: `progress` (percent, message), `complete` (results), `error` (message)
  - [ ] `useBacktestStream` hook: `EventSource` API → parse events → dispatch to Redux

- [ ] **35. Implement SSE for optimization progress**
  - [ ] Same pattern for grid search: stream current params + % of combinations tested
  - [ ] Heatmap renders progressively as results stream in

---

## Phase 11 — Polish & Edge Cases

- [ ] **36. Error handling & loading states**
  - [ ] Global error boundary (`app/error.tsx`)
  - [ ] Loading skeletons for all data-fetching pages (`loading.tsx`)
  - [ ] Toast notifications (shadcn `Sonner`) for success/error feedback
  - [ ] Inline form validation errors via zod + react-hook-form

- [ ] **37. Responsive design**
  - [ ] Sidebar collapses to hamburger on mobile
  - [ ] Charts resize responsively
  - [ ] Strategy Builder stacks vertically on small screens
  - [ ] Data tables scroll horizontally on mobile

- [ ] **38. Backtesting edge cases**
  - [ ] Handle tickers with insufficient data for the selected date range
  - [ ] Handle weekends/holidays in date ranges
  - [ ] Handle delisted tickers gracefully
  - [ ] Pairs trading: validate overlapping date ranges for both tickers
  - [ ] Alpha Vantage rate limiting (25 req/day) — queue + retry logic

---

## Phase 12 — Deployment

- [ ] **39. Deploy FastAPI to Render**
  - [ ] Finalize `Dockerfile` in `/backend`
  - [ ] Create Render web service, point to `/backend` directory
  - [ ] Set environment variables on Render (Alpha Vantage key, CORS origin)
  - [ ] Verify `GET /health` endpoint returns 200

- [ ] **40. Deploy Next.js to Vercel**
  - [ ] Connect repo to Vercel, set root to `/frontend`
  - [ ] Configure all environment variables on Vercel
  - [ ] Add `postinstall: prisma generate` to `package.json` scripts
  - [ ] Verify SSE streaming works with Vercel serverless functions

- [ ] **41. Production hardening**
  - [ ] Rate limiting on API routes
  - [ ] Request timeouts for backtest runs (5 min max)
  - [ ] Structured logging (Python: `loguru`; Next.js: `pino` or built-in)
  - [ ] Basic monitoring (Render metrics + Vercel analytics)

---

## Verification & Testing

- [ ] **Unit tests** — Python strategy engine + metrics with known test data
- [ ] **Integration tests** — Full backtest flow: API trigger → results → metrics verified
- [ ] **Manual smoke test checklist**
  - [ ] Google login works, session persists across refresh
  - [ ] Ticker search returns relevant results
  - [ ] All 5 strategies run successfully on SPY 2020–2024
  - [ ] Results dashboard renders all metrics + charts correctly
  - [ ] Save, duplicate, and delete strategies work
  - [ ] Comparison view overlays equity curves for 2–4 strategies
  - [ ] Parameter optimization runs and renders heatmap
  - [ ] SSE progress streaming works in real-time
  - [ ] App is functional on mobile viewport

# Project Overview

## Mission & Purpose

The app exists to close the gap between a trading idea and validated evidence — letting you define a strategy in minutes, run it against years of real market data, and get a clear answer: does this edge actually exist?

Unlike heavyweight platforms like QuantConnect or TradeStation that are either code-heavy or expensive, this is your personal, lightweight, beautifully designed tool. It lives in the browser, requires no setup, and is built exactly around the strategies you actually use.

---

## Core Feature Modules

### 1. Strategy Builder

The heart of the app — a UI-based form where you configure a backtest run without writing code:

- **Asset selector** — search any ticker (stocks, ETFs) powered by Yahoo Finance / yfinance
- **Date range picker** — define the historical window (e.g., 2018–2024)
- **Strategy type selector** — choose from a library of supported strategies (see below)
- **Parameter inputs** — dynamic fields that change based on strategy (e.g., Z-score threshold for mean reversion, window size for MA crossover)
- **Risk settings** — starting capital, position sizing (fixed $ vs. % of portfolio), stop-loss %, take-profit %
- **Benchmark selector** — compare against SPY, QQQ, or a custom ticker

### 2. Strategy Library

Pre-built strategies you can run out of the box, each with tunable parameters:

| Strategy | Parameters | Your Interest |
|---|---|---|
| Mean Reversion | Z-score window, threshold, holding period | ✅ Direct match |
| Moving Average Crossover | Fast/slow MA period, MA type (EMA/SMA) | Classic momentum |
| Earnings Drift (PEAD) | Days before/after earnings, EPS surprise threshold | ✅ Direct match |
| Pairs Trading | Correlation window, spread threshold, cointegration test | Advanced quant |
| Buy & Hold | None — baseline benchmark | Comparison baseline |

### 3. Results Dashboard

After a backtest runs, the results page is your analytics command center:

**Performance Cards (top row):**
- Total Return %, Annualized Return %, Max Drawdown %, Sharpe Ratio, Sortino Ratio, Win Rate %, Profit Factor

**Charts panel:**
- **Equity Curve** — portfolio value over time vs. benchmark
- **Drawdown Chart** — underwater periods visualized as a filled area
- **Monthly Returns Heatmap** — calendar grid of monthly P&L (like a hedge fund tearsheet)
- **Trade Distribution** — histogram of individual trade returns

**Trade Log Table:**
- Full list of every entry/exit with date, price, P&L, holding duration, and reason for exit

### 4. Strategy Comparison View

Run multiple parameter configurations side by side — e.g., test mean reversion with Z-score thresholds of 1.5, 2.0, and 2.5 simultaneously. Renders a comparison table of all performance metrics and overlays equity curves on a single chart.

### 5. User Workspace (Saved Strategies)

- Save any backtest run as a named "experiment"
- Tag runs (e.g., `#mean-reversion`, `#tech-sector`)
- View full history of all past runs sorted by Sharpe ratio or total return
- Duplicate a saved run to tweak parameters

---

## User Flows

### Flow 1 — First-Time User

```
Landing Page
  → Sign Up (email/Google via NextAuth)
  → Onboarding modal: "Pick your first strategy template"
  → Pre-filled Strategy Builder (e.g., SPY Mean Reversion 2020–2024)
  → Run Backtest → Results Dashboard
  → Prompted to save as first experiment
```

### Flow 2 — Running a New Backtest

```
Dashboard (Workspace)
  → Click "New Backtest"
  → Strategy Builder:
      1. Search & select ticker(s)
      2. Select date range
      3. Choose strategy type
      4. Configure parameters
      5. Set risk rules
      6. Choose benchmark
  → Click "Run" → Loading state (streaming progress via SSE)
  → Results page renders incrementally as data processes
  → Save / Export / Share
```

### Flow 3 — Parameter Optimization

```
Any saved strategy
  → Click "Optimize Parameters"
  → Define parameter ranges + step sizes (e.g., Z-score: 1.0 → 3.0, step 0.25)
  → System runs grid search across all combinations
  → Results render as a heatmap (param A vs. param B → Sharpe Ratio)
  → Click any cell to drill into that specific run's full results
```

### Flow 4 — Strategy Comparison

```
Workspace
  → Select 2–4 saved experiments (checkboxes)
  → Click "Compare"
  → Side-by-side metrics table + overlaid equity curves
  → Export comparison as PDF or PNG
```

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Next.js 15 App Router               │
│                                                      │
│  app/                                               │
│  ├── (auth)/login, signup        ← public routes    │
│  ├── dashboard/                  ← protected        │
│  │   ├── page.tsx                ← workspace        │
│  │   ├── new/page.tsx            ← strategy builder │
│  │   ├── results/[id]/page.tsx   ← results view     │
│  │   └── compare/page.tsx        ← comparison       │
│  └── api/                                           │
│      ├── backtest/route.ts       ← triggers Python  │
│      ├── tickers/route.ts        ← ticker search    │
│      └── strategies/route.ts    ← CRUD              │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP / Server Actions
         ┌─────────▼──────────┐
         │  Python Microservice│  (FastAPI)
         │  - yfinance data    │
         │  - backtest engine  │
         │  - metrics calc     │
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │   PostgreSQL        │  (via Prisma ORM)
         │   - users           │
         │   - strategies      │
         │   - backtest runs   │
         │   - results cache   │
         └────────────────────┘
```

---

## Integrations

| Integration | Purpose | Cost |
|---|---|---|
| yfinance (Python) | Historical OHLCV data for any ticker | Free |
| Yahoo Finance Search API | Ticker autocomplete search | Free |
| Alpha Vantage | Earnings calendar data (for PEAD strategy) | Free tier (25 req/day) |
| NextAuth.js | Google + email/password authentication | Free |
| Prisma + PostgreSQL | Store users, strategies, results | Free (Supabase or Neon) |
| Recharts / Tremor | Equity curves, drawdown charts, heatmaps | Free OSS |
| FastAPI (Python) | Backtesting microservice wrapping yfinance + your math | Free |
| Server-Sent Events (SSE) | Stream backtest progress to the browser in real-time | Free (built-in Next.js) |
| Vercel | Hosting Next.js frontend | Free tier |
| Railway / Render | Hosting Python FastAPI microservice | Free tier |

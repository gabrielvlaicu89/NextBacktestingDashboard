/**
 * Shared TypeScript types — mirrors backend Pydantic schemas + Prisma enums.
 * These are used across API routes, Redux slices, hooks, and components.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type StrategyType =
  | "MEAN_REVERSION"
  | "MA_CROSSOVER"
  | "EARNINGS_DRIFT"
  | "PAIRS_TRADING"
  | "BUY_AND_HOLD";

export type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type PositionSizingMode = "FIXED_DOLLAR" | "PERCENT_PORTFOLIO";

export type MAType = "SMA" | "EMA";

// ── Sub-models ────────────────────────────────────────────────────────────────

export interface RiskSettings {
  starting_capital: number;
  position_sizing_mode: PositionSizingMode;
  position_size: number;
  stop_loss_pct: number | null;
  take_profit_pct: number | null;
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  starting_capital: 10_000,
  position_sizing_mode: "PERCENT_PORTFOLIO",
  position_size: 100,
  stop_loss_pct: null,
  take_profit_pct: null,
};

// ── Trade & Metrics ───────────────────────────────────────────────────────────

export interface TradeResult {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_pct: number;
  holding_days: number;
  exit_reason: string;
}

export interface PerformanceMetrics {
  total_return_pct: number;
  annualized_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  win_rate_pct: number;
  profit_factor: number;
}

// ── Backtest Response ─────────────────────────────────────────────────────────

export interface BacktestResponse {
  metrics: PerformanceMetrics;
  equity_curve: Array<{ date: string; value: number; benchmark_value: number }>;
  drawdown_series: Array<{ date: string; drawdown_pct: number }>;
  monthly_returns: Array<{ year: number; month: number; return_pct: number }>;
  trades: TradeResult[];
}

// ── SSE Events ────────────────────────────────────────────────────────────────

export interface SSEProgressEvent {
  type: "progress";
  percent: number;
  message: string;
}

export interface SSECompleteEvent {
  type: "complete";
  results: BacktestResponse;
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
}

export type SSEEvent = SSEProgressEvent | SSECompleteEvent | SSEErrorEvent;

// ── Ticker Search ─────────────────────────────────────────────────────────────

export interface TickerResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

// ── Strategy Catalog (from FastAPI /api/strategies/types) ─────────────────────

export interface StrategyParam {
  key: string;
  label: string;
  type: "number" | "select" | "ticker";
  default?: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface StrategyCatalogItem {
  type: StrategyType;
  label: string;
  description: string;
  params: StrategyParam[];
}

// ── Prisma model shapes (serialised for client) ──────────────────────────────

export interface StrategyRecord {
  id: string;
  userId: string;
  name: string;
  type: StrategyType;
  ticker: string;
  benchmark: string;
  dateFrom: string;
  dateTo: string;
  parameters: Record<string, unknown>;
  riskSettings: RiskSettings;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BacktestRunRecord {
  id: string;
  strategyId: string;
  userId: string;
  status: RunStatus;
  results: BacktestResponse | null;
  errorMsg: string | null;
  duration: number | null;
  createdAt: string;
}

export interface StrategyWithRuns extends StrategyRecord {
  runs: BacktestRunRecord[];
}

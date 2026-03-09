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

export type StrategyBuilderMode = "BUILT_IN" | "CUSTOM";

export type CustomStrategyDefinitionVersion = 1;

export type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type PositionSizingMode = "FIXED_DOLLAR" | "PERCENT_PORTFOLIO";

export type MAType = "SMA" | "EMA";

export type RuleGroupOperator = "AND" | "OR";

export type ComparisonOperator =
  | ">"
  | ">="
  | "<"
  | "<="
  | "=="
  | "crosses_above"
  | "crosses_below";

export type PriceField = "OPEN" | "HIGH" | "LOW" | "CLOSE" | "VOLUME";

export type IndicatorParamValue = string | number | boolean;

export type IndicatorOutputKey = "value" | "upper" | "middle" | "lower" | "histogram";

export type CustomIndicatorParamType = "number" | "select" | "boolean";

export interface CustomIndicatorParamOption {
  label: string;
  value: string;
}

export interface CustomIndicatorParamDefinition {
  key: string;
  label: string;
  type: CustomIndicatorParamType;
  default: IndicatorParamValue;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: CustomIndicatorParamOption[];
}

export interface CustomIndicatorCatalogItem {
  id: string;
  label: string;
  description: string;
  category: string;
  outputs: IndicatorOutputKey[];
  params: CustomIndicatorParamDefinition[];
}

export interface IndicatorNode {
  id: string;
  indicatorId: string;
  label: string;
  params: Record<string, IndicatorParamValue>;
}

export interface PriceOperand {
  kind: "price";
  field: PriceField;
}

export interface IndicatorOperand {
  kind: "indicator";
  indicatorId: string;
  output?: IndicatorOutputKey;
}

export interface ConstantOperand {
  kind: "constant";
  value: number;
}

export type RuleOperand = PriceOperand | IndicatorOperand | ConstantOperand;

export interface RuleCondition {
  type: "condition";
  left: RuleOperand;
  comparator: ComparisonOperator;
  right: RuleOperand;
}

export interface RuleGroup {
  type: "group";
  operator: RuleGroupOperator;
  conditions: RuleNode[];
}

export type RuleNode = RuleCondition | RuleGroup;

export interface CustomStrategyDefinition {
  version: CustomStrategyDefinitionVersion;
  name: string;
  description: string;
  indicators: IndicatorNode[];
  longEntry: RuleGroup;
  longExit: RuleGroup;
  shortEntry: RuleGroup;
  shortExit: RuleGroup;
}

export interface CustomStrategyDefinitionRecord {
  id: string;
  userId: string;
  name: string;
  description: string;
  definitionVersion: number;
  definition: CustomStrategyDefinition;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

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
  profit_factor: number | null;
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
  /** Individual result entry — sent during optimization for progressive rendering */
  result?: OptimizeResultEntry;
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

// ── Optimization ─────────────────────────────────────────────────────────────

export interface OptimizeResultEntry {
  params: Record<string, number>;
  metric: number | null;
}

export interface ParamRange {
  min: number;
  max: number;
  step: number;
}

export interface OptimizeConfig {
  strategy_type: string;
  ticker: string;
  date_from: string;
  date_to: string;
  benchmark: string;
  risk_settings: RiskSettings;
  fixed_parameters: Record<string, unknown>;
  param_ranges: Record<string, ParamRange>;
  optimize_for: string;
}

export const OPTIMIZE_METRICS: { value: string; label: string }[] = [
  { value: "sharpe_ratio", label: "Sharpe Ratio" },
  { value: "total_return_pct", label: "Total Return %" },
  { value: "annualized_return_pct", label: "Annualized Return %" },
  { value: "sortino_ratio", label: "Sortino Ratio" },
  { value: "win_rate_pct", label: "Win Rate %" },
];

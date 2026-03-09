/**
 * Strategy catalog — client-side mirror of backend STRATEGY_CATALOG.
 *
 * This is the source of truth for rendering dynamic strategy forms.
 * If a new strategy is added to the backend, add it here too.
 */
import type { BuiltInStrategyType, StrategyCatalogItem } from "@/lib/types";

export const STRATEGY_CATALOG: StrategyCatalogItem[] = [
  {
    type: "MEAN_REVERSION",
    label: "Mean Reversion",
    description:
      "Trades when price deviates significantly from its rolling mean (Z-score based).",
    params: [
      {
        key: "zscore_window",
        label: "Z-Score Window",
        type: "number",
        default: 20,
        min: 5,
      },
      {
        key: "zscore_threshold",
        label: "Z-Score Threshold",
        type: "number",
        default: 2.0,
        min: 0.5,
        step: 0.25,
      },
      {
        key: "holding_period",
        label: "Max Holding Period (days)",
        type: "number",
        default: 10,
        min: 1,
      },
    ],
  },
  {
    type: "MA_CROSSOVER",
    label: "Moving Average Crossover",
    description:
      "Buys on the golden cross (fast MA crosses above slow MA) and sells on the death cross.",
    params: [
      {
        key: "fast_period",
        label: "Fast MA Period",
        type: "number",
        default: 10,
        min: 2,
      },
      {
        key: "slow_period",
        label: "Slow MA Period",
        type: "number",
        default: 50,
        min: 5,
      },
      {
        key: "ma_type",
        label: "MA Type",
        type: "select",
        options: ["SMA", "EMA"],
        default: "EMA",
      },
    ],
  },
  {
    type: "EARNINGS_DRIFT",
    label: "Earnings Drift (PEAD)",
    description:
      "Trades the post-earnings announcement drift by entering before earnings and holding after.",
    params: [
      {
        key: "days_before",
        label: "Days Before Earnings",
        type: "number",
        default: 2,
        min: 0,
      },
      {
        key: "days_after",
        label: "Days After Earnings",
        type: "number",
        default: 5,
        min: 1,
      },
      {
        key: "eps_surprise_threshold",
        label: "EPS Surprise Threshold (%)",
        type: "number",
        default: 0.0,
        min: 0,
        step: 0.5,
      },
    ],
  },
  {
    type: "PAIRS_TRADING",
    label: "Pairs Trading",
    description:
      "Trades the spread between two cointegrated tickers when it deviates beyond a threshold.",
    params: [
      {
        key: "ticker_b",
        label: "Second Ticker",
        type: "ticker",
      },
      {
        key: "correlation_window",
        label: "Correlation Window (days)",
        type: "number",
        default: 60,
        min: 20,
      },
      {
        key: "spread_threshold",
        label: "Spread Z-Score Threshold",
        type: "number",
        default: 2.0,
        min: 0.5,
        step: 0.25,
      },
    ],
  },
  {
    type: "BUY_AND_HOLD",
    label: "Buy & Hold",
    description:
      "Buys on day one and holds until the end of the period. Use as a baseline benchmark.",
    params: [],
  },
];

/** Look up a catalog item by strategy type. */
export function getCatalogItem(
  type: BuiltInStrategyType
): StrategyCatalogItem | undefined {
  return STRATEGY_CATALOG.find((item) => item.type === type);
}

/** Strategy type → human-readable label map for quick lookups. */
export const STRATEGY_LABELS: Record<BuiltInStrategyType, string> = Object.fromEntries(
  STRATEGY_CATALOG.map((item) => [item.type, item.label])
) as Record<BuiltInStrategyType, string>;

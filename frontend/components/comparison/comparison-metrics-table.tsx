"use client";

/**
 * ComparisonMetricsTable — side-by-side metrics for multiple strategies.
 *
 * Rows = metric labels, Columns = strategy names.
 * The best value per row is highlighted green.
 */

import type { StrategyWithRuns, BacktestResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Metric definitions ────────────────────────────────────────────────────────

interface MetricDef {
  key: keyof BacktestResponse["metrics"];
  label: string;
  format: (v: number) => string;
  /** Higher value = better performance */
  higherIsBetter: boolean;
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: "total_return_pct",
    label: "Total Return",
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
    higherIsBetter: true,
  },
  {
    key: "annualized_return_pct",
    label: "Annualized Return",
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
    higherIsBetter: true,
  },
  {
    key: "max_drawdown_pct",
    label: "Max Drawdown",
    format: (v) => `${v.toFixed(2)}%`,
    higherIsBetter: true, // -2% is better than -20% (higher value = less loss)
  },
  {
    key: "sharpe_ratio",
    label: "Sharpe Ratio",
    format: (v) => v.toFixed(2),
    higherIsBetter: true,
  },
  {
    key: "sortino_ratio",
    label: "Sortino Ratio",
    format: (v) => v.toFixed(2),
    higherIsBetter: true,
  },
  {
    key: "win_rate_pct",
    label: "Win Rate",
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
  },
  {
    key: "profit_factor",
    label: "Profit Factor",
    format: (v) => v.toFixed(2),
    higherIsBetter: true,
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface ComparisonItem {
  strategy: StrategyWithRuns;
  metrics: BacktestResponse["metrics"] | undefined;
}

interface ComparisonMetricsTableProps {
  items: ComparisonItem[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ComparisonMetricsTable({ items }: ComparisonMetricsTableProps) {
  if (items.length === 0) return null;

  return (
    <div
      data-testid="comparison-metrics-table"
      className="overflow-x-auto rounded-lg border"
    >
      <table className="w-full min-w-[500px] text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-40">
              Metric
            </th>
            {items.map(({ strategy }) => (
              <th
                key={strategy.id}
                className="px-4 py-3 text-right font-semibold max-w-[180px]"
              >
                <div className="truncate" title={strategy.name}>
                  {strategy.name}
                </div>
                <div className="text-xs font-normal text-muted-foreground">
                  {strategy.ticker}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_DEFS.map((def, rowIdx) => {
            // Find the best (max) raw value for this metric
            const values = items.map((item) =>
              item.metrics != null ? item.metrics[def.key] : null,
            );
            const defined = values.filter((v): v is number => v !== null);
            const bestValue =
              defined.length > 0 ? Math.max(...defined) : null;

            return (
              <tr
                key={def.key}
                data-testid={`metric-row-${def.key}`}
                className={cn(
                  "border-t",
                  rowIdx % 2 === 0 ? "bg-background" : "bg-muted/20",
                )}
              >
                <td className="px-4 py-2.5 font-medium text-muted-foreground">
                  {def.label}
                </td>
                {items.map(({ strategy, metrics }) => {
                  const raw = metrics?.[def.key] ?? null;
                  const isBest =
                    raw !== null &&
                    bestValue !== null &&
                    raw === bestValue &&
                    defined.length > 1;

                  return (
                    <td
                      key={strategy.id}
                      data-testid={`cell-${def.key}-${strategy.id}`}
                      className={cn(
                        "px-4 py-2.5 text-right tabular-nums",
                        isBest &&
                          "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-semibold",
                        raw === null && "text-muted-foreground italic",
                      )}
                    >
                      {raw !== null ? def.format(raw) : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

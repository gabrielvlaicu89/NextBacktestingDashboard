"use client";

/**
 * PerformanceCards — displays 7 metric cards in a responsive grid.
 *
 * Color-coded: green for positive values, red for negative.
 */
import type { PerformanceMetrics } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricDef {
  key: keyof PerformanceMetrics;
  label: string;
  format: (v: number | null) => string;
  colorize: boolean; // true = green/red based on sign
  invertColor?: boolean; // true = negative is good (e.g., drawdown)
}

function formatSignedPercent(value: number | null): string {
  return value === null ? "N/A" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

function formatDecimal(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(2);
}

function formatWinRate(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: "total_return_pct",
    label: "Total Return",
    format: formatSignedPercent,
    colorize: true,
  },
  {
    key: "annualized_return_pct",
    label: "Annualized Return",
    format: formatSignedPercent,
    colorize: true,
  },
  {
    key: "max_drawdown_pct",
    label: "Max Drawdown",
    format: formatPercent,
    colorize: true,
    invertColor: true,
  },
  {
    key: "sharpe_ratio",
    label: "Sharpe Ratio",
    format: formatDecimal,
    colorize: true,
  },
  {
    key: "sortino_ratio",
    label: "Sortino Ratio",
    format: formatDecimal,
    colorize: true,
  },
  {
    key: "win_rate_pct",
    label: "Win Rate",
    format: formatWinRate,
    colorize: true,
  },
  {
    key: "profit_factor",
    label: "Profit Factor",
    format: formatDecimal,
    colorize: true,
  },
];

function getColorClass(value: number, invert = false): string {
  const isPositive = invert ? value <= 0 : value > 0;
  const isNeutral = value === 0;
  if (isNeutral) return "text-muted-foreground";
  return isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function hasNumericValue(value: number | null): value is number {
  return value !== null;
}

interface PerformanceCardsProps {
  metrics: PerformanceMetrics;
}

export function PerformanceCards({ metrics }: PerformanceCardsProps) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="performance-cards"
    >
      {METRIC_DEFS.map((def) => {
        const value = metrics[def.key];
        return (
          <Card key={def.key} data-testid={`metric-${def.key}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {def.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-2xl font-bold",
                  hasNumericValue(value) &&
                    def.colorize &&
                    getColorClass(value, def.invertColor),
                  !hasNumericValue(value) && "text-muted-foreground",
                )}
                data-testid={`metric-value-${def.key}`}
              >
                {def.format(value)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export { METRIC_DEFS };

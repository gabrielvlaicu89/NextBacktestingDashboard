"use client";

/**
 * TradeDistributionChart — Recharts bar chart showing P&L distribution.
 *
 * Buckets trades by P&L % range, green for profit, red for loss.
 */
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradeResult } from "@/lib/types";

interface TradeDistributionChartProps {
  trades: TradeResult[];
}

interface Bucket {
  range: string;
  count: number;
  isProfit: boolean;
  midpoint: number;
}

function bucketTrades(trades: TradeResult[]): Bucket[] {
  if (trades.length === 0) return [];

  // Define bucket boundaries: ..., -10%, -5%, 0%, 5%, 10%, ...
  const step = 5;
  const min = Math.floor(Math.min(...trades.map((t) => t.pnl_pct)) / step) * step;
  const max = Math.ceil(Math.max(...trades.map((t) => t.pnl_pct)) / step) * step;

  const buckets: Bucket[] = [];
  for (let low = min; low < max; low += step) {
    const high = low + step;
    const count = trades.filter(
      (t) => t.pnl_pct >= low && t.pnl_pct < high
    ).length;
    buckets.push({
      range: `${low}% to ${high}%`,
      count,
      isProfit: low >= 0,
      midpoint: low + step / 2,
    });
  }

  return buckets;
}

export function TradeDistributionChart({
  trades,
}: TradeDistributionChartProps) {
  const buckets = useMemo(() => bucketTrades(trades), [trades]);

  if (trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No trades to display.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="trade-distribution-chart">
      <CardHeader>
        <CardTitle>Trade Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={buckets} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              label={{
                value: "Trades",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12 },
              }}
            />
            <Tooltip
              formatter={(value: number) => [`${value} trades`, "Count"]}
              labelStyle={{ fontWeight: 600 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {buckets.map((bucket, idx) => (
                <Cell
                  key={idx}
                  fill={bucket.isProfit ? "#22c55e" : "#ef4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export { bucketTrades };

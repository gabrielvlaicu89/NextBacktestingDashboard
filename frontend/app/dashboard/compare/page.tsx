/**
 * app/dashboard/compare/page.tsx — Strategy Comparison Page (Server Component)
 *
 * Accepts ?ids=id1,id2,id3 query params.
 * Fetches each strategy with its backtest runs, then passes data to
 * the client components for the metrics table and equity chart.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getStrategiesByIds } from "@/lib/actions/strategies";
import { ComparisonMetricsTable } from "@/components/comparison/comparison-metrics-table";
import { ComparisonEquityChart, COMPARISON_COLORS } from "@/components/comparison/comparison-equity-chart";
import type { BacktestResponse, StrategyWithRuns } from "@/lib/types";

interface ComparePageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { ids: idsParam } = await searchParams;
  const ids = (idsParam ?? "").split(",").filter(Boolean);

  if (ids.length < 2) {
    redirect("/dashboard");
  }

  let strategies: StrategyWithRuns[] = [];
  try {
    strategies = await getStrategiesByIds(ids);
  } catch {
    // keep empty array
  }

  // Build per-strategy comparison items
  const items = strategies.map((strategy) => {
    const latestRun = strategy.runs.find((r) => r.status === "COMPLETED");
    return {
      strategy,
      metrics: latestRun?.results?.metrics as
        | BacktestResponse["metrics"]
        | undefined,
      equityCurve: (latestRun?.results?.equity_curve ?? []) as BacktestResponse["equity_curve"],
    };
  });

  // Build equity series (one per strategy, normalized in the chart component)
  const equitySeries = items.map((item, idx) => ({
    id: item.strategy.id,
    name: item.strategy.name,
    color: COMPARISON_COLORS[idx % COMPARISON_COLORS.length],
    data: item.equityCurve.map((d) => ({ date: d.date, value: d.value })),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Strategy Comparison
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comparing {strategies.length} strateg{strategies.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">← Back to Workspace</Link>
        </Button>
      </div>

      {/* Metrics Table */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Performance Metrics</h2>
        <ComparisonMetricsTable items={items} />
      </section>

      {/* Equity Chart */}
      <section>
        <ComparisonEquityChart series={equitySeries} />
      </section>
    </div>
  );
}

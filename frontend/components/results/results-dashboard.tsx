"use client";

/**
 * ResultsDashboard — client component that orchestrates the entire results view.
 *
 * If in-flight: shows progress bar from Redux.
 * If completed: renders all result panels (metrics, charts, trades).
 * If failed: shows error message.
 */
import { useSelector, type TypedUseSelectorHook } from "react-redux";
import type { RootState } from "@/store/store";
import type { BacktestResponse, StrategyWithRuns } from "@/lib/types";

const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
import { BacktestProgressBar } from "@/components/results/backtest-progress-bar";
import { PerformanceCards } from "@/components/results/performance-cards";
import { EquityCurveChart } from "@/components/results/equity-curve-chart";
import { DrawdownChart } from "@/components/results/drawdown-chart";
import { MonthlyReturnsHeatmap } from "@/components/results/monthly-returns-heatmap";
import { TradeDistributionChart } from "@/components/results/trade-distribution-chart";
import { TradeLogTable } from "@/components/results/trade-log-table";
import { SaveExperimentDialog } from "@/components/results/save-experiment-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";

interface ResultsDashboardProps {
  /** Pre-loaded strategy + runs from the server (for /results/[id] route) */
  strategy?: StrategyWithRuns;
  /** Pre-loaded results (from DB) — used when viewing a past run */
  savedResults?: BacktestResponse | null;
  /** ID of the strategy — for the save dialog */
  strategyId?: string;
}

export function ResultsDashboard({
  strategy,
  savedResults,
  strategyId,
}: ResultsDashboardProps) {
  const backtestStatus = useAppSelector((s) => s.backtest.status);
  const progress = useAppSelector((s) => s.backtest.progress);
  const message = useAppSelector((s) => s.backtest.message);
  const reduxResults = useAppSelector((s) => s.backtest.results);
  const reduxError = useAppSelector((s) => s.backtest.error);
  const reduxStrategyId = useAppSelector((s) => s.backtest.strategyId);

  // Prefer saved results when viewing a historical run, otherwise use Redux (live run)
  const results: BacktestResponse | null = savedResults ?? reduxResults;
  const effectiveStrategyId = strategyId ?? reduxStrategyId ?? undefined;

  // ── Running state ──
  if (backtestStatus === "running") {
    return <BacktestProgressBar progress={progress} message={message} />;
  }

  // ── Failed state ──
  if (backtestStatus === "failed" && !results) {
    return (
      <div
        className="flex flex-col items-center gap-4 py-16 text-center"
        data-testid="backtest-error"
      >
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <h2 className="text-lg font-semibold">Backtest Failed</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {reduxError || "An unexpected error occurred."}
          </p>
        </div>
      </div>
    );
  }

  // ── No results yet ──
  if (!results) {
    return (
      <div
        className="flex flex-col items-center gap-4 py-16 text-center"
        data-testid="no-results"
      >
        <p className="text-sm text-muted-foreground">
          No results to display. Run a backtest to see results here.
        </p>
      </div>
    );
  }

  // ── Results available ──
  const strategyName =
    strategy?.name ?? "Backtest Results";
  const strategyTags = strategy?.tags ?? [];

  return (
    <div className="space-y-6" data-testid="results-dashboard">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {strategyName}
          </h1>
          {strategy && (
            <p className="mt-1 text-sm text-muted-foreground">
              {strategy.ticker} · {strategy.type.replace(/_/g, " ")} ·{" "}
              {strategy.dateFrom.split("T")[0]} to{" "}
              {strategy.dateTo.split("T")[0]}
            </p>
          )}
        </div>
        {effectiveStrategyId && (
          <SaveExperimentDialog
            strategyId={effectiveStrategyId}
            currentName={strategyName}
            currentTags={strategyTags}
          />
        )}
      </div>

      {/* Performance Cards */}
      <PerformanceCards metrics={results.metrics} />

      {/* Charts in tabs */}
      <Tabs defaultValue="equity" className="w-full">
        <TabsList>
          <TabsTrigger value="equity">Equity Curve</TabsTrigger>
          <TabsTrigger value="drawdown">Drawdown</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Returns</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="equity" className="mt-4">
          <EquityCurveChart data={results.equity_curve} />
        </TabsContent>

        <TabsContent value="drawdown" className="mt-4">
          <DrawdownChart data={results.drawdown_series} />
        </TabsContent>

        <TabsContent value="monthly" className="mt-4">
          <MonthlyReturnsHeatmap data={results.monthly_returns} />
        </TabsContent>

        <TabsContent value="distribution" className="mt-4">
          <TradeDistributionChart trades={results.trades} />
        </TabsContent>
      </Tabs>

      {/* Trade Log */}
      <TradeLogTable trades={results.trades} />
    </div>
  );
}

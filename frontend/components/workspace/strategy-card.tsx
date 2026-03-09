"use client";

/**
 * StrategyCard — displays a single saved strategy with key metrics,
 * tags, and action buttons (View Results, Duplicate, Delete, Compare checkbox).
 */
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toggleStrategy } from "@/store/slices/comparisonSlice";
import { removeStrategy } from "@/store/slices/workspaceSlice";
import {
  prefillFromStrategy,
  resetBuilder,
  setBenchmark,
  setCustomStrategyDraft,
  setDateRange,
  setName,
  setRiskSettings,
  setTags,
  setTicker,
} from "@/store/slices/strategyBuilderSlice";
import { deleteStrategy } from "@/lib/actions/strategies";
import type { CustomStrategyDefinition, StrategyWithRuns } from "@/lib/types";
import type { RootState } from "@/store/store";

// ── Strategy type labels ──────────────────────────────────────────────────────

const STRATEGY_LABELS: Record<string, string> = {
  MEAN_REVERSION: "Mean Reversion",
  MA_CROSSOVER: "MA Crossover",
  EARNINGS_DRIFT: "Earnings Drift",
  PAIRS_TRADING: "Pairs Trading",
  BUY_AND_HOLD: "Buy & Hold",
  CUSTOM: "Custom Strategy",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface StrategyCardProps {
  strategy: StrategyWithRuns;
}

export function StrategyCard({ strategy }: StrategyCardProps) {
  const router = useRouter();
  const dispatch = useDispatch();
  const selectedIds = useSelector(
    (state: RootState) => state.comparison.selectedIds,
  );
  const isSelected = selectedIds.includes(strategy.id);

  // Get metrics from the latest completed run
  const latestRun = strategy.runs.find((r) => r.status === "COMPLETED");
  const metrics = latestRun?.results?.metrics;

  const handleViewResults = () => {
    if (latestRun) {
      router.push(`/dashboard/results/${latestRun.id}`);
    }
  };

  const handleDuplicate = () => {
    if (strategy.type === "CUSTOM") {
      const customDefinition = strategy.parameters.custom_definition as
        | CustomStrategyDefinition
        | undefined;

      if (!customDefinition) {
        toast.error("This custom strategy is missing its saved definition snapshot");
        return;
      }

      dispatch(resetBuilder());
      dispatch(setCustomStrategyDraft(customDefinition));
      dispatch(setTicker(strategy.ticker));
      dispatch(
        setDateRange({
          from: strategy.dateFrom,
          to: strategy.dateTo,
        }),
      );
      dispatch(setRiskSettings(strategy.riskSettings));
      dispatch(setBenchmark(strategy.benchmark));
      dispatch(setName(`${strategy.name} (Copy)`));
      dispatch(setTags(strategy.tags));
      router.push("/dashboard/new");
      return;
    }

    dispatch(
      prefillFromStrategy({
        ticker: strategy.ticker,
        dateFrom: strategy.dateFrom,
        dateTo: strategy.dateTo,
        strategyType: strategy.type,
        parameters: strategy.parameters,
        riskSettings: strategy.riskSettings,
        benchmark: strategy.benchmark,
        name: `${strategy.name} (Copy)`,
        tags: strategy.tags,
      }),
    );
    router.push("/dashboard/new");
  };

  const handleDelete = async () => {
    try {
      await deleteStrategy(strategy.id);
      dispatch(removeStrategy(strategy.id));
      toast.success("Strategy deleted successfully");
    } catch {
      toast.error("Failed to delete strategy");
    }
  };

  const handleToggleCompare = () => {
    dispatch(toggleStrategy(strategy.id));
  };

  const formatDate = (iso: string) => {
    try {
      return format(new Date(iso), "MMM d, yyyy");
    } catch {
      return iso;
    }
  };

  return (
    <Card data-testid="strategy-card" className="relative">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              {strategy.name}
            </CardTitle>
            <CardDescription className="mt-1">
              {STRATEGY_LABELS[strategy.type] ?? strategy.type} ·{" "}
              {strategy.ticker}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex items-center gap-2">
              <label
                htmlFor={`compare-${strategy.id}`}
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Compare
              </label>
              <Checkbox
                id={`compare-${strategy.id}`}
                checked={isSelected}
                onCheckedChange={handleToggleCompare}
                aria-label={`Select ${strategy.name} for comparison`}
              />
            </div>
          </CardAction>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Date range */}
        <p className="text-xs text-muted-foreground">
          {formatDate(strategy.dateFrom)} — {formatDate(strategy.dateTo)}
        </p>

        {/* Key metrics */}
        {metrics ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Return</span>
              <p
                className={
                  metrics.total_return_pct >= 0
                    ? "font-semibold text-green-600 dark:text-green-400"
                    : "font-semibold text-red-600 dark:text-red-400"
                }
              >
                {metrics.total_return_pct >= 0 ? "+" : ""}
                {metrics.total_return_pct.toFixed(2)}%
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Sharpe</span>
              <p className="font-semibold">
                {metrics.sharpe_ratio.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Max DD</span>
              <p className="font-semibold text-red-600 dark:text-red-400">
                {metrics.max_drawdown_pct.toFixed(2)}%
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Win Rate</span>
              <p className="font-semibold">
                {metrics.win_rate_pct.toFixed(1)}%
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No completed runs
          </p>
        )}

        {/* Tags */}
        {strategy.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {strategy.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={handleViewResults}
          disabled={!latestRun}
        >
          View Results
        </Button>
        <Button variant="outline" size="sm" onClick={handleDuplicate}>
          Duplicate
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete strategy?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{strategy.name}&quot; and all
                its backtest runs. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

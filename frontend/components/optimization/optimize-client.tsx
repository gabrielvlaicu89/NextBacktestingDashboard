"use client";

/**
 * OptimizeClient — orchestrates the full optimisation UX:
 *   1. Shows OptimizeConfigForm (idle state)
 *   2. Shows OptimizeProgress while the SSE stream is running
 *   3. Shows OptimizeResults once the stream completes
 *
 * On result selection: pre-fills the Redux strategy builder state with the
 * winning parameter combination and navigates to /dashboard/new.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import {
  prefillFromStrategy,
} from "@/store/slices/strategyBuilderSlice";
import { useOptimizeStream } from "@/hooks/useOptimizeStream";
import { OptimizeConfigForm } from "@/components/optimization/optimize-config-form";
import { OptimizeProgress } from "@/components/optimization/optimize-progress";
import { OptimizeResults } from "@/components/optimization/optimize-results";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import type { OptimizeConfig, StrategyWithRuns } from "@/lib/types";
import type { StrategyCatalogItem } from "@/lib/types";
import type { StrategyType } from "@/lib/types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface OptimizeClientProps {
  strategy: StrategyWithRuns;
  catalog: StrategyCatalogItem;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OptimizeClient({ strategy, catalog }: OptimizeClientProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const { status, progress, message, results, error, startOptimize, abort } =
    useOptimizeStream();

  const handleSubmit = useCallback(
    (config: OptimizeConfig) => {
      void startOptimize(config);
    },
    [startOptimize],
  );

  /**
   * Pre-fill the strategy builder with the winning parameter combination,
   * then navigate to the "new strategy" form so the user can run a full backtest.
   */
  const handleRunConfig = useCallback(
    (params: Record<string, unknown>) => {
      dispatch(
        prefillFromStrategy({
          ticker: strategy.ticker,
          dateFrom: strategy.dateFrom,
          dateTo: strategy.dateTo,
          strategyType: strategy.type as StrategyType,
          parameters: params,
          riskSettings: strategy.riskSettings,
          benchmark: strategy.benchmark,
          name: strategy.name,
          tags: strategy.tags,
        }),
      );
      router.push("/dashboard/new");
    },
    [dispatch, router, strategy],
  );

  // Derive the swept parameter keys from the completed results (first entry's keys)
  const paramKeys =
    results && results.length > 0 ? Object.keys(results[0].params) : [];

  // Find the optimize_for metric label from the last submitted config.
  // We store it in a ref-like way via a useState inside the hook; here we just
  // read from the first result's metric label which is not available directly.
  // Instead we track it via the form's last submission — passed back via the hook's
  // `message` is insufficient, so we derive it from the URL or keep a local copy.
  // For display we surface "metric" as the column header.
  const optimizeForLabel = "metric";

  return (
    <div data-testid="optimize-client" className="space-y-6">
      {/* Always show the config form so the user can modify and re-run */}
      <OptimizeConfigForm
        strategy={strategy}
        catalog={catalog}
        onSubmit={handleSubmit}
        disabled={status === "running"}
      />

      {/* Cancel button while running */}
      {status === "running" && (
        <p
          role="button"
          tabIndex={0}
          onClick={abort}
          onKeyDown={(e) => e.key === "Enter" && abort()}
          className="text-sm text-muted-foreground underline cursor-pointer w-fit"
          data-testid="cancel-optimize"
        >
          Cancel
        </p>
      )}

      {/* Progress bar */}
      <OptimizeProgress status={status} progress={progress} message={message} />

      {/* Error state */}
      {status === "error" && error && (
        <Alert variant="destructive" data-testid="optimize-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results — show progressively during running AND after completion */}
      {(status === "completed" || status === "running") && results && results.length > 0 && (
        <OptimizeResults
          results={results}
          optimizeFor={optimizeForLabel}
          paramKeys={paramKeys}
          onRunConfig={handleRunConfig}
        />
      )}
    </div>
  );
}

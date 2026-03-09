"use client";

/**
 * useBacktestStream — connects to the SSE backtest endpoint and
 * dispatches progress / results / errors into the Redux backtest slice.
 *
 * Usage:
 *   const { startBacktest, abort } = useBacktestStream();
 *   await startBacktest({ strategy_type: "MEAN_REVERSION", ticker: "SPY", ... });
 */
import { useCallback, useRef } from "react";
import { useAppDispatch } from "@/store/hooks";
import {
  setRunId,
  setStrategyId,
  setStatus,
  setProgress,
  setMessage,
  setResults,
  setError,
  resetBacktest,
} from "@/store/slices/backtestSlice";
import { createBacktestRun } from "@/lib/actions/backtest";
import { toast } from "sonner";
import type { SSEEvent } from "@/lib/types";

interface BacktestConfig {
  name?: string;
  tags?: string[];
  strategy_type: string;
  ticker: string;
  date_from: string;
  date_to: string;
  benchmark?: string;
  risk_settings?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

export function useBacktestStream() {
  const dispatch = useAppDispatch();
  const eventSourceRef = useRef<EventSource | null>(null);

  const abort = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const startBacktest = useCallback(
    async (config: BacktestConfig) => {
      // Reset previous state
      dispatch(resetBacktest());
      dispatch(setStatus("running"));

      try {
        // Step 1: Create Strategy + BacktestRun records via server action
        const { strategyId, runId } = await createBacktestRun(config);
        dispatch(setStrategyId(strategyId));
        dispatch(setRunId(runId));

        // Step 2: Open SSE connection to the backtest streaming endpoint
        abort(); // close any existing connection

        const es = new EventSource(`/api/backtest?runId=${runId}`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const data: SSEEvent = JSON.parse(event.data);

            switch (data.type) {
              case "progress":
                dispatch(setProgress(data.percent));
                dispatch(setMessage(data.message));
                break;

              case "complete":
                dispatch(setResults(data.results));
                dispatch(setStatus("completed"));
                dispatch(setProgress(100));
                toast.success("Backtest completed");
                es.close();
                eventSourceRef.current = null;
                break;

              case "error":
                dispatch(setError(data.message));
                dispatch(setStatus("failed"));
                toast.error(data.message);
                es.close();
                eventSourceRef.current = null;
                break;
            }
          } catch {
            // Ignore unparseable events
          }
        };

        es.onerror = () => {
          dispatch(setError("Connection to backtest stream lost"));
          dispatch(setStatus("failed"));
          es.close();
          eventSourceRef.current = null;
        };
      } catch (err) {
        dispatch(setError(err instanceof Error ? err.message : "Failed to start backtest"));
        dispatch(setStatus("failed"));
      }
    },
    [dispatch, abort],
  );

  return { startBacktest, abort };
}

/**
 * Tests for the backtest Redux slice.
 */
import { describe, it, expect } from "vitest";
import {
  backtestReducer,
  setRunId,
  setStrategyId,
  setStatus,
  setProgress,
  setMessage,
  setResults,
  setError,
  resetBacktest,
} from "@/store/slices/backtestSlice";
import type { BacktestState } from "@/store/slices/backtestSlice";
import type { BacktestResponse } from "@/lib/types";

const initial: BacktestState = {
  runId: null,
  strategyId: null,
  status: "idle",
  progress: 0,
  message: "",
  results: null,
  error: null,
};

const mockResults: BacktestResponse = {
  metrics: {
    total_return_pct: 15.5,
    annualized_return_pct: 12.3,
    max_drawdown_pct: -8.2,
    sharpe_ratio: 1.45,
    sortino_ratio: 1.89,
    win_rate_pct: 62.5,
    profit_factor: 1.8,
  },
  equity_curve: [{ date: "2024-01-02", value: 10000, benchmark_value: 10000 }],
  drawdown_series: [{ date: "2024-01-02", drawdown_pct: 0 }],
  monthly_returns: [{ year: 2024, month: 1, return_pct: 2.5 }],
  trades: [
    {
      entry_date: "2024-01-10",
      exit_date: "2024-01-20",
      entry_price: 100,
      exit_price: 110,
      pnl: 1000,
      pnl_pct: 10,
      holding_days: 10,
      exit_reason: "signal",
    },
  ],
};

describe("backtestSlice", () => {
  it("returns the initial state", () => {
    const state = backtestReducer(undefined, { type: "@@INIT" });
    expect(state).toEqual(initial);
  });

  it("setRunId", () => {
    const state = backtestReducer(initial, setRunId("run-123"));
    expect(state.runId).toBe("run-123");
  });

  it("setStrategyId", () => {
    const state = backtestReducer(initial, setStrategyId("strat-456"));
    expect(state.strategyId).toBe("strat-456");
  });

  it("setStatus transitions state", () => {
    let state = backtestReducer(initial, setStatus("running"));
    expect(state.status).toBe("running");

    state = backtestReducer(state, setStatus("completed"));
    expect(state.status).toBe("completed");
  });

  it("setProgress updates progress percentage", () => {
    const state = backtestReducer(initial, setProgress(42));
    expect(state.progress).toBe(42);
  });

  it("setMessage updates the status message", () => {
    const state = backtestReducer(initial, setMessage("Fetching market data…"));
    expect(state.message).toBe("Fetching market data…");
  });

  it("setResults stores backtest response", () => {
    const state = backtestReducer(initial, setResults(mockResults));
    expect(state.results).toEqual(mockResults);
    expect(state.results!.metrics.sharpe_ratio).toBe(1.45);
    expect(state.results!.trades).toHaveLength(1);
  });

  it("setError stores the error message", () => {
    const state = backtestReducer(initial, setError("Backend unavailable"));
    expect(state.error).toBe("Backend unavailable");
  });

  it("resetBacktest returns to initial state", () => {
    const modified: BacktestState = {
      runId: "r1",
      strategyId: "s1",
      status: "completed",
      progress: 100,
      message: "Done",
      results: mockResults,
      error: null,
    };
    const state = backtestReducer(modified, resetBacktest());
    expect(state).toEqual(initial);
  });

  it("handles a full progress lifecycle", () => {
    let state = initial;
    state = backtestReducer(state, setStatus("running"));
    state = backtestReducer(state, setRunId("run-1"));
    state = backtestReducer(state, setProgress(30));
    state = backtestReducer(state, setMessage("Running strategy…"));
    state = backtestReducer(state, setProgress(100));
    state = backtestReducer(state, setResults(mockResults));
    state = backtestReducer(state, setStatus("completed"));

    expect(state.status).toBe("completed");
    expect(state.progress).toBe(100);
    expect(state.results).toBeTruthy();
    expect(state.error).toBeNull();
  });
});

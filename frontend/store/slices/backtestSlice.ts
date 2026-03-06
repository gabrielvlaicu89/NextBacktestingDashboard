/**
 * Backtest slice — tracks the current backtest run's lifecycle.
 *
 * Populated by the useBacktestStream hook as SSE events arrive.
 * Phases: idle → running → completed | failed
 */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { BacktestResponse } from "@/lib/types";

export interface BacktestState {
  runId: string | null;
  strategyId: string | null;
  status: "idle" | "running" | "completed" | "failed";
  progress: number;
  message: string;
  results: BacktestResponse | null;
  error: string | null;
}

const initialState: BacktestState = {
  runId: null,
  strategyId: null,
  status: "idle",
  progress: 0,
  message: "",
  results: null,
  error: null,
};

const backtestSlice = createSlice({
  name: "backtest",
  initialState,
  reducers: {
    setRunId(state, action: PayloadAction<string>) {
      state.runId = action.payload;
    },
    setStrategyId(state, action: PayloadAction<string>) {
      state.strategyId = action.payload;
    },
    setStatus(state, action: PayloadAction<BacktestState["status"]>) {
      state.status = action.payload;
    },
    setProgress(state, action: PayloadAction<number>) {
      state.progress = action.payload;
    },
    setMessage(state, action: PayloadAction<string>) {
      state.message = action.payload;
    },
    setResults(state, action: PayloadAction<BacktestResponse>) {
      state.results = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
    resetBacktest() {
      return { ...initialState };
    },
  },
});

export const {
  setRunId,
  setStrategyId,
  setStatus,
  setProgress,
  setMessage,
  setResults,
  setError,
  resetBacktest,
} = backtestSlice.actions;

export const backtestReducer = backtestSlice.reducer;

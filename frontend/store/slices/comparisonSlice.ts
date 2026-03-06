/**
 * Comparison slice — tracks which strategies are selected for side-by-side comparison
 * and holds the fetched results for those strategies.
 */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { BacktestResponse } from "@/lib/types";

export interface ComparisonState {
  /** Strategy IDs selected for comparison (max ~4 for readable charts). */
  selectedIds: string[];
  /** Keyed by strategy ID — loaded lazily when comparison page opens. */
  results: Record<string, BacktestResponse>;
}

const initialState: ComparisonState = {
  selectedIds: [],
  results: {},
};

const comparisonSlice = createSlice({
  name: "comparison",
  initialState,
  reducers: {
    toggleStrategy(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.selectedIds.indexOf(id);
      if (idx >= 0) {
        state.selectedIds.splice(idx, 1);
        delete state.results[id];
      } else {
        state.selectedIds.push(id);
      }
    },
    setSelectedIds(state, action: PayloadAction<string[]>) {
      state.selectedIds = action.payload;
    },
    setComparisonResult(
      state,
      action: PayloadAction<{ id: string; results: BacktestResponse }>,
    ) {
      state.results[action.payload.id] = action.payload.results;
    },
    clearComparison() {
      return { ...initialState };
    },
  },
});

export const { toggleStrategy, setSelectedIds, setComparisonResult, clearComparison } =
  comparisonSlice.actions;

export const comparisonReducer = comparisonSlice.reducer;

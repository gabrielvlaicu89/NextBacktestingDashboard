/**
 * Tests for the comparison Redux slice.
 */
import { describe, it, expect } from "vitest";
import {
  comparisonReducer,
  toggleStrategy,
  setSelectedIds,
  setComparisonResult,
  clearComparison,
} from "@/store/slices/comparisonSlice";
import type { ComparisonState } from "@/store/slices/comparisonSlice";
import type { BacktestResponse } from "@/lib/types";

const initial: ComparisonState = {
  selectedIds: [],
  results: {},
};

const mockResults: BacktestResponse = {
  metrics: {
    total_return_pct: 10,
    annualized_return_pct: 8,
    max_drawdown_pct: -5,
    sharpe_ratio: 1.2,
    sortino_ratio: 1.5,
    win_rate_pct: 55,
    profit_factor: 1.3,
  },
  equity_curve: [],
  drawdown_series: [],
  monthly_returns: [],
  trades: [],
};

describe("comparisonSlice", () => {
  it("returns the initial state", () => {
    const state = comparisonReducer(undefined, { type: "@@INIT" });
    expect(state).toEqual(initial);
  });

  it("toggleStrategy adds an ID", () => {
    const state = comparisonReducer(initial, toggleStrategy("s1"));
    expect(state.selectedIds).toEqual(["s1"]);
  });

  it("toggleStrategy removes an existing ID and its results", () => {
    const existing: ComparisonState = {
      selectedIds: ["s1", "s2"],
      results: { s1: mockResults, s2: mockResults },
    };
    const state = comparisonReducer(existing, toggleStrategy("s1"));
    expect(state.selectedIds).toEqual(["s2"]);
    expect(state.results).not.toHaveProperty("s1");
    expect(state.results).toHaveProperty("s2");
  });

  it("setSelectedIds replaces all selections", () => {
    const state = comparisonReducer(initial, setSelectedIds(["a", "b", "c"]));
    expect(state.selectedIds).toEqual(["a", "b", "c"]);
  });

  it("setComparisonResult stores results by ID", () => {
    const state = comparisonReducer(
      initial,
      setComparisonResult({ id: "s1", results: mockResults }),
    );
    expect(state.results["s1"]).toEqual(mockResults);
  });

  it("clearComparison resets everything", () => {
    const withData: ComparisonState = {
      selectedIds: ["s1"],
      results: { s1: mockResults },
    };
    const state = comparisonReducer(withData, clearComparison());
    expect(state).toEqual(initial);
  });
});

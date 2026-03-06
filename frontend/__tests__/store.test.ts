/**
 * Tests for the Redux store configuration.
 * Validates that all slices are properly registered and the store initialises correctly.
 */
import { describe, it, expect } from "vitest";
import { store } from "@/store/store";

describe("Redux store", () => {
  it("has all expected slice keys", () => {
    const state = store.getState();
    expect(state).toHaveProperty("strategyBuilder");
    expect(state).toHaveProperty("backtest");
    expect(state).toHaveProperty("comparison");
    expect(state).toHaveProperty("workspace");
  });

  it("strategyBuilder initialises with empty ticker", () => {
    const { strategyBuilder } = store.getState();
    expect(strategyBuilder.ticker).toBe("");
    expect(strategyBuilder.strategyType).toBeNull();
    expect(strategyBuilder.benchmark).toBe("SPY");
  });

  it("backtest initialises as idle", () => {
    const { backtest } = store.getState();
    expect(backtest.status).toBe("idle");
    expect(backtest.runId).toBeNull();
    expect(backtest.results).toBeNull();
  });

  it("comparison initialises with empty selections", () => {
    const { comparison } = store.getState();
    expect(comparison.selectedIds).toEqual([]);
    expect(comparison.results).toEqual({});
  });

  it("workspace initialises as not loading with no strategies", () => {
    const { workspace } = store.getState();
    expect(workspace.strategies).toEqual([]);
    expect(workspace.loading).toBe(false);
    expect(workspace.sortBy).toBe("createdAt");
  });
});

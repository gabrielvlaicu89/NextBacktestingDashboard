/**
 * Tests for the workspace Redux slice.
 */
import { describe, it, expect } from "vitest";
import {
  workspaceReducer,
  setStrategies,
  setLoading,
  setSortBy,
  setSortDirection,
  setFilterType,
  setFilterTags,
  removeStrategy,
} from "@/store/slices/workspaceSlice";
import type { WorkspaceState } from "@/store/slices/workspaceSlice";
import type { StrategyWithRuns } from "@/lib/types";
import { DEFAULT_RISK_SETTINGS } from "@/lib/types";

const initial: WorkspaceState = {
  strategies: [],
  loading: false,
  sortBy: "createdAt",
  sortDirection: "desc",
  filterType: null,
  filterTags: [],
};

const mockStrategy: StrategyWithRuns = {
  id: "strat-1",
  userId: "user-1",
  name: "SPY Mean Reversion",
  type: "MEAN_REVERSION",
  ticker: "SPY",
  benchmark: "SPY",
  dateFrom: "2024-01-01T00:00:00.000Z",
  dateTo: "2024-12-31T00:00:00.000Z",
  parameters: { zscore_window: 20 },
  riskSettings: DEFAULT_RISK_SETTINGS,
  tags: ["momentum"],
  createdAt: "2024-06-01T00:00:00.000Z",
  updatedAt: "2024-06-01T00:00:00.000Z",
  runs: [],
};

describe("workspaceSlice", () => {
  it("returns the initial state", () => {
    const state = workspaceReducer(undefined, { type: "@@INIT" });
    expect(state).toEqual(initial);
  });

  it("setStrategies populates strategies and clears loading", () => {
    const loading: WorkspaceState = { ...initial, loading: true };
    const state = workspaceReducer(loading, setStrategies([mockStrategy]));
    expect(state.strategies).toHaveLength(1);
    expect(state.strategies[0].id).toBe("strat-1");
    expect(state.loading).toBe(false);
  });

  it("setLoading toggles the loading flag", () => {
    const state = workspaceReducer(initial, setLoading(true));
    expect(state.loading).toBe(true);
  });

  it("setSortBy changes sort field", () => {
    const state = workspaceReducer(initial, setSortBy("sharpe"));
    expect(state.sortBy).toBe("sharpe");
  });

  it("setSortDirection changes sort order", () => {
    const state = workspaceReducer(initial, setSortDirection("asc"));
    expect(state.sortDirection).toBe("asc");
  });

  it("setFilterType sets strategy type filter", () => {
    const state = workspaceReducer(initial, setFilterType("MA_CROSSOVER"));
    expect(state.filterType).toBe("MA_CROSSOVER");
  });

  it("setFilterType can be cleared to null", () => {
    const filtered = { ...initial, filterType: "MA_CROSSOVER" as const };
    const state = workspaceReducer(filtered, setFilterType(null));
    expect(state.filterType).toBeNull();
  });

  it("setFilterTags replaces tags filter", () => {
    const state = workspaceReducer(initial, setFilterTags(["momentum", "large-cap"]));
    expect(state.filterTags).toEqual(["momentum", "large-cap"]);
  });

  it("removeStrategy removes by ID", () => {
    const withStrategies: WorkspaceState = {
      ...initial,
      strategies: [
        mockStrategy,
        { ...mockStrategy, id: "strat-2", name: "AAPL MA Crossover" },
      ],
    };
    const state = workspaceReducer(withStrategies, removeStrategy("strat-1"));
    expect(state.strategies).toHaveLength(1);
    expect(state.strategies[0].id).toBe("strat-2");
  });
});

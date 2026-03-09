/**
 * Tests for the strategyBuilder Redux slice.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_STRATEGY_START_DATE,
  strategyBuilderReducer,
  setTicker,
  setDateRange,
  setStrategyType,
  setParameter,
  setParameters,
  setRiskSettings,
  setBenchmark,
  setName,
  setTags,
  prefillFromStrategy,
  resetBuilder,
} from "@/store/slices/strategyBuilderSlice";
import type { StrategyBuilderState } from "@/store/slices/strategyBuilderSlice";
import { DEFAULT_RISK_SETTINGS } from "@/lib/types";

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const initial: StrategyBuilderState = {
  ticker: "",
  dateFrom: DEFAULT_STRATEGY_START_DATE,
  dateTo: getTodayDateString(),
  strategyType: null,
  parameters: {},
  riskSettings: DEFAULT_RISK_SETTINGS,
  benchmark: "SPY",
  name: "",
  tags: [],
};

describe("strategyBuilderSlice", () => {
  it("returns the initial state", () => {
    const state = strategyBuilderReducer(undefined, { type: "@@INIT" });
    expect(state).toEqual(initial);
  });

  it("setTicker updates ticker", () => {
    const state = strategyBuilderReducer(initial, setTicker("AAPL"));
    expect(state.ticker).toBe("AAPL");
  });

  it("setDateRange updates both dates", () => {
    const state = strategyBuilderReducer(
      initial,
      setDateRange({ from: "2024-01-01", to: "2024-12-31" }),
    );
    expect(state.dateFrom).toBe("2024-01-01");
    expect(state.dateTo).toBe("2024-12-31");
  });

  it("setStrategyType updates type and resets parameters", () => {
    const withParams = { ...initial, parameters: { zscore_window: 20 } };
    const state = strategyBuilderReducer(withParams, setStrategyType("MA_CROSSOVER"));
    expect(state.strategyType).toBe("MA_CROSSOVER");
    expect(state.parameters).toEqual({});
  });

  it("setParameter adds a single parameter", () => {
    const state = strategyBuilderReducer(initial, setParameter({ key: "zscore_window", value: 30 }));
    expect(state.parameters).toEqual({ zscore_window: 30 });
  });

  it("setParameters replaces all parameters", () => {
    const existing = { ...initial, parameters: { old: true } };
    const state = strategyBuilderReducer(
      existing,
      setParameters({ fast_period: 10, slow_period: 50 }),
    );
    expect(state.parameters).toEqual({ fast_period: 10, slow_period: 50 });
  });

  it("setRiskSettings merges with existing settings", () => {
    const state = strategyBuilderReducer(
      initial,
      setRiskSettings({ starting_capital: 50_000, stop_loss_pct: 5 }),
    );
    expect(state.riskSettings.starting_capital).toBe(50_000);
    expect(state.riskSettings.stop_loss_pct).toBe(5);
    // Unset fields remain at defaults
    expect(state.riskSettings.position_sizing_mode).toBe("PERCENT_PORTFOLIO");
  });

  it("setBenchmark updates benchmark", () => {
    const state = strategyBuilderReducer(initial, setBenchmark("QQQ"));
    expect(state.benchmark).toBe("QQQ");
  });

  it("setName updates name", () => {
    const state = strategyBuilderReducer(initial, setName("My Strategy"));
    expect(state.name).toBe("My Strategy");
  });

  it("setTags replaces tags", () => {
    const state = strategyBuilderReducer(initial, setTags(["momentum", "large-cap"]));
    expect(state.tags).toEqual(["momentum", "large-cap"]);
  });

  it("prefillFromStrategy fully replaces state", () => {
    const prefilled = {
      ticker: "MSFT",
      dateFrom: "2023-01-01",
      dateTo: "2023-12-31",
      strategyType: "MEAN_REVERSION" as const,
      parameters: { zscore_window: 15 },
      riskSettings: { ...DEFAULT_RISK_SETTINGS, starting_capital: 25_000 },
      benchmark: "SPY",
      name: "Duplicated",
      tags: ["copy"],
    };
    const state = strategyBuilderReducer(initial, prefillFromStrategy(prefilled));
    expect(state).toEqual(prefilled);
  });

  it("resetBuilder returns to initial state", () => {
    const modified = { ...initial, ticker: "GOOG", name: "Test" };
    const state = strategyBuilderReducer(modified, resetBuilder());
    expect(state).toEqual(initial);
  });
});

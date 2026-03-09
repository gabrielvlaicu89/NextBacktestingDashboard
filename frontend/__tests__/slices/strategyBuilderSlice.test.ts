/**
 * Tests for the strategyBuilder Redux slice.
 */
import { describe, it, expect } from "vitest";
import {
  addCustomIndicator,
  DEFAULT_STRATEGY_START_DATE,
  removeCustomIndicator,
  setBuilderMode,
  setCustomStrategyDraft,
  updateCustomIndicatorLabel,
  updateCustomIndicatorParam,
  updateCustomStrategyMeta,
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
  builderMode: "BUILT_IN",
  strategyType: null,
  parameters: {},
  customStrategy: {
    version: 1,
    name: "",
    description: "",
    indicators: [],
    longEntry: { type: "group", operator: "AND", conditions: [] },
    longExit: { type: "group", operator: "AND", conditions: [] },
    shortEntry: { type: "group", operator: "AND", conditions: [] },
    shortExit: { type: "group", operator: "AND", conditions: [] },
  },
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
    const withParams = {
      ...initial,
      builderMode: "CUSTOM" as const,
      parameters: { zscore_window: 20 },
    };
    const state = strategyBuilderReducer(withParams, setStrategyType("MA_CROSSOVER"));
    expect(state.builderMode).toBe("BUILT_IN");
    expect(state.strategyType).toBe("MA_CROSSOVER");
    expect(state.parameters).toEqual({});
  });

  it("setBuilderMode switches between built-in and custom modes", () => {
    const state = strategyBuilderReducer(initial, setBuilderMode("CUSTOM"));
    expect(state.builderMode).toBe("CUSTOM");
  });

  it("setCustomStrategyDraft stores a full custom draft and switches to custom mode", () => {
    const customDraft = {
      version: 1 as const,
      name: "Custom RSI Reversal",
      description: "Test draft",
      indicators: [
        {
          id: "rsi-1",
          indicatorId: "RSI",
          label: "RSI 14",
          params: { period: 14 },
        },
      ],
      longEntry: {
        type: "group" as const,
        operator: "AND" as const,
        conditions: [],
      },
      longExit: {
        type: "group" as const,
        operator: "AND" as const,
        conditions: [],
      },
      shortEntry: {
        type: "group" as const,
        operator: "AND" as const,
        conditions: [],
      },
      shortExit: {
        type: "group" as const,
        operator: "AND" as const,
        conditions: [],
      },
    };

    const state = strategyBuilderReducer(initial, setCustomStrategyDraft(customDraft));
    expect(state.builderMode).toBe("CUSTOM");
    expect(state.customStrategy).toEqual(customDraft);
  });

  it("updateCustomStrategyMeta updates the custom draft name and description", () => {
    const state = strategyBuilderReducer(
      initial,
      updateCustomStrategyMeta({
        name: "Custom Mean Reversion",
        description: "Uses RSI and price conditions.",
      }),
    );

    expect(state.builderMode).toBe("CUSTOM");
    expect(state.customStrategy.name).toBe("Custom Mean Reversion");
    expect(state.customStrategy.description).toBe("Uses RSI and price conditions.");
  });

  it("addCustomIndicator appends an indicator to the custom draft", () => {
    const state = strategyBuilderReducer(
      initial,
      addCustomIndicator({
        id: "rsi-1",
        indicatorId: "RSI",
        label: "RSI 14",
        params: { period: 14 },
      }),
    );

    expect(state.builderMode).toBe("CUSTOM");
    expect(state.customStrategy.indicators).toEqual([
      {
        id: "rsi-1",
        indicatorId: "RSI",
        label: "RSI 14",
        params: { period: 14 },
      },
    ]);
  });

  it("updateCustomIndicatorLabel changes the label of an existing indicator", () => {
    const withIndicator = strategyBuilderReducer(
      initial,
      addCustomIndicator({
        id: "rsi-1",
        indicatorId: "RSI",
        label: "RSI 14",
        params: { period: 14 },
      }),
    );

    const state = strategyBuilderReducer(
      withIndicator,
      updateCustomIndicatorLabel({ id: "rsi-1", label: "RSI Fast" }),
    );

    expect(state.customStrategy.indicators[0]?.label).toBe("RSI Fast");
  });

  it("updateCustomIndicatorParam changes the params of an existing indicator", () => {
    const withIndicator = strategyBuilderReducer(
      initial,
      addCustomIndicator({
        id: "rsi-1",
        indicatorId: "RSI",
        label: "RSI 14",
        params: { period: 14 },
      }),
    );

    const state = strategyBuilderReducer(
      withIndicator,
      updateCustomIndicatorParam({ id: "rsi-1", key: "period", value: 21 }),
    );

    expect(state.customStrategy.indicators[0]?.params).toEqual({ period: 21 });
  });

  it("removeCustomIndicator removes the indicator from the custom draft", () => {
    const withIndicator = strategyBuilderReducer(
      initial,
      addCustomIndicator({
        id: "rsi-1",
        indicatorId: "RSI",
        label: "RSI 14",
        params: { period: 14 },
      }),
    );

    const state = strategyBuilderReducer(
      withIndicator,
      removeCustomIndicator("rsi-1"),
    );

    expect(state.customStrategy.indicators).toEqual([]);
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
      builderMode: "BUILT_IN" as const,
      strategyType: "MEAN_REVERSION" as const,
      parameters: { zscore_window: 15 },
      customStrategy: initial.customStrategy,
      riskSettings: { ...DEFAULT_RISK_SETTINGS, starting_capital: 25_000 },
      benchmark: "SPY",
      name: "Duplicated",
      tags: ["copy"],
    };
    const state = strategyBuilderReducer(initial, prefillFromStrategy(prefilled));
    expect(state).toEqual(prefilled);
  });

  it("resetBuilder returns to initial state", () => {
    const modified = {
      ...initial,
      ticker: "GOOG",
      name: "Test",
      builderMode: "CUSTOM" as const,
      customStrategy: {
        ...initial.customStrategy,
        name: "Draft",
      },
    };
    const state = strategyBuilderReducer(modified, resetBuilder());
    expect(state).toEqual(initial);
  });
});

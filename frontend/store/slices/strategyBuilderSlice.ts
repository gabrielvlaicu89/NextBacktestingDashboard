/**
 * Strategy Builder slice — holds the form draft state for creating/editing a backtest.
 *
 * This is ephemeral client-side state that drives the Strategy Builder form (Phase 6).
 * On submission, the data flows to a server action → Prisma, not back into this slice.
 */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { StrategyType, RiskSettings } from "@/lib/types";
import { DEFAULT_RISK_SETTINGS } from "@/lib/types";

export const DEFAULT_STRATEGY_START_DATE = "2020-01-01";

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createInitialState(): StrategyBuilderState {
  return {
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
}

export interface StrategyBuilderState {
  ticker: string;
  dateFrom: string;
  dateTo: string;
  strategyType: StrategyType | null;
  parameters: Record<string, unknown>;
  riskSettings: RiskSettings;
  benchmark: string;
  name: string;
  tags: string[];
}

const initialState: StrategyBuilderState = createInitialState();

const strategyBuilderSlice = createSlice({
  name: "strategyBuilder",
  initialState,
  reducers: {
    setTicker(state, action: PayloadAction<string>) {
      state.ticker = action.payload;
    },
    setDateRange(state, action: PayloadAction<{ from: string; to: string }>) {
      state.dateFrom = action.payload.from;
      state.dateTo = action.payload.to;
    },
    setStrategyType(state, action: PayloadAction<StrategyType>) {
      state.strategyType = action.payload;
      state.parameters = {}; // reset params when type changes
    },
    setParameter(state, action: PayloadAction<{ key: string; value: unknown }>) {
      state.parameters[action.payload.key] = action.payload.value;
    },
    setParameters(state, action: PayloadAction<Record<string, unknown>>) {
      state.parameters = action.payload;
    },
    setRiskSettings(state, action: PayloadAction<Partial<RiskSettings>>) {
      state.riskSettings = { ...state.riskSettings, ...action.payload };
    },
    setBenchmark(state, action: PayloadAction<string>) {
      state.benchmark = action.payload;
    },
    setName(state, action: PayloadAction<string>) {
      state.name = action.payload;
    },
    setTags(state, action: PayloadAction<string[]>) {
      state.tags = action.payload;
    },
    /** Pre-fill the form from an existing strategy (used by "Duplicate" flow). */
    prefillFromStrategy(
      state,
      action: PayloadAction<{
        ticker: string;
        dateFrom: string;
        dateTo: string;
        strategyType: StrategyType;
        parameters: Record<string, unknown>;
        riskSettings: RiskSettings;
        benchmark: string;
        name: string;
        tags: string[];
      }>,
    ) {
      return { ...action.payload };
    },
    resetBuilder() {
      return createInitialState();
    },
  },
});

export const {
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
} = strategyBuilderSlice.actions;

export const strategyBuilderReducer = strategyBuilderSlice.reducer;

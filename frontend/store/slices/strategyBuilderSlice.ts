/**
 * Strategy Builder slice — holds the form draft state for creating/editing a backtest.
 *
 * This is ephemeral client-side state that drives the Strategy Builder form (Phase 6).
 * On submission, the data flows to a server action → Prisma, not back into this slice.
 */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type {
  ComparisonOperator,
  BuiltInStrategyType,
  ConstantOperand,
  CustomRuleSection,
  CustomStrategyDefinition,
  IndicatorOperand,
  IndicatorNode,
  IndicatorParamValue,
  PriceOperand,
  RiskSettings,
  RuleCondition,
  RuleGroup,
  RuleNode,
  RuleNodePath,
  RuleOperand,
  StrategyBuilderMode,
} from "@/lib/types";
import { DEFAULT_RISK_SETTINGS } from "@/lib/types";

export const DEFAULT_STRATEGY_START_DATE = "2020-01-01";

function createEmptyRuleGroup(): RuleGroup {
  return {
    type: "group",
    operator: "AND",
    conditions: [],
  };
}

function createDefaultPriceOperand(): PriceOperand {
  return {
    kind: "price",
    field: "CLOSE",
  };
}

function createDefaultConstantOperand(): ConstantOperand {
  return {
    kind: "constant",
    value: 0,
  };
}

function createDefaultIndicatorOperand(indicatorId?: string): IndicatorOperand {
  return {
    kind: "indicator",
    indicatorId: indicatorId ?? "",
  };
}

function createEmptyRuleCondition(primaryIndicatorId?: string): RuleCondition {
  return {
    type: "condition",
    left: primaryIndicatorId
      ? createDefaultIndicatorOperand(primaryIndicatorId)
      : createDefaultPriceOperand(),
    comparator: ">",
    right: createDefaultConstantOperand(),
  };
}

function getRuleGroup(state: StrategyBuilderState, section: CustomRuleSection): RuleGroup {
  return state.customStrategy[section];
}

function getRuleNodeAtPath(
  group: RuleGroup,
  path: RuleNodePath,
): RuleNode | undefined {
  let current: RuleNode = group;

  for (const index of path) {
    if (current.type !== "group") {
      return undefined;
    }

    current = current.conditions[index];
    if (!current) {
      return undefined;
    }
  }

  return current;
}

function getRuleGroupAtPath(
  group: RuleGroup,
  path: RuleNodePath = [],
): RuleGroup | undefined {
  const node = getRuleNodeAtPath(group, path);
  return node?.type === "group" ? node : undefined;
}

function getParentRuleGroupAtPath(
  group: RuleGroup,
  path: RuleNodePath,
): RuleGroup | undefined {
  return path.length === 0
    ? undefined
    : getRuleGroupAtPath(group, path.slice(0, -1));
}

export function createEmptyCustomStrategyDraft(): CustomStrategyDefinition {
  return {
    version: 1,
    name: "",
    description: "",
    indicators: [],
    longEntry: createEmptyRuleGroup(),
    longExit: createEmptyRuleGroup(),
    shortEntry: createEmptyRuleGroup(),
    shortExit: createEmptyRuleGroup(),
  };
}

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
    builderMode: "BUILT_IN",
    strategyType: null,
    parameters: {},
    customStrategy: createEmptyCustomStrategyDraft(),
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
  builderMode: StrategyBuilderMode;
  strategyType: BuiltInStrategyType | null;
  parameters: Record<string, unknown>;
  customStrategy: CustomStrategyDefinition;
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
    setBuilderMode(state, action: PayloadAction<StrategyBuilderMode>) {
      state.builderMode = action.payload;
    },
    setStrategyType(state, action: PayloadAction<BuiltInStrategyType>) {
      state.builderMode = "BUILT_IN";
      state.strategyType = action.payload;
      state.parameters = {}; // reset params when type changes
    },
    setCustomStrategyDraft(state, action: PayloadAction<CustomStrategyDefinition>) {
      state.builderMode = "CUSTOM";
      state.customStrategy = action.payload;
    },
    updateCustomStrategyMeta(
      state,
      action: PayloadAction<Pick<CustomStrategyDefinition, "name" | "description">>,
    ) {
      state.builderMode = "CUSTOM";
      state.customStrategy = {
        ...state.customStrategy,
        ...action.payload,
      };
    },
    addCustomIndicator(state, action: PayloadAction<IndicatorNode>) {
      state.builderMode = "CUSTOM";
      state.customStrategy.indicators.push(action.payload);
    },
    updateCustomIndicatorLabel(
      state,
      action: PayloadAction<{ id: string; label: string }>,
    ) {
      state.builderMode = "CUSTOM";
      const indicator = state.customStrategy.indicators.find(
        (entry) => entry.id === action.payload.id,
      );

      if (indicator) {
        indicator.label = action.payload.label;
      }
    },
    updateCustomIndicatorParam(
      state,
      action: PayloadAction<{ id: string; key: string; value: IndicatorParamValue }>,
    ) {
      state.builderMode = "CUSTOM";
      const indicator = state.customStrategy.indicators.find(
        (entry) => entry.id === action.payload.id,
      );

      if (indicator) {
        indicator.params[action.payload.key] = action.payload.value;
      }
    },
    removeCustomIndicator(state, action: PayloadAction<string>) {
      state.builderMode = "CUSTOM";
      state.customStrategy.indicators = state.customStrategy.indicators.filter(
        (indicator) => indicator.id !== action.payload,
      );
    },
    updateCustomRuleGroupOperator(
      state,
      action: PayloadAction<{
        section: CustomRuleSection;
        path?: RuleNodePath;
        operator: RuleGroup["operator"];
      }>,
    ) {
      state.builderMode = "CUSTOM";
      const group = getRuleGroupAtPath(
        getRuleGroup(state, action.payload.section),
        action.payload.path ?? [],
      );

      if (group) {
        group.operator = action.payload.operator;
      }
    },
    addCustomRuleCondition(
      state,
      action: PayloadAction<{ section: CustomRuleSection; path?: RuleNodePath }>,
    ) {
      state.builderMode = "CUSTOM";
      const primaryIndicatorId = state.customStrategy.indicators[0]?.id;
      const group = getRuleGroupAtPath(
        getRuleGroup(state, action.payload.section),
        action.payload.path ?? [],
      );

      if (group) {
        group.conditions.push(createEmptyRuleCondition(primaryIndicatorId));
      }
    },
    addCustomRuleGroup(
      state,
      action: PayloadAction<{ section: CustomRuleSection; path?: RuleNodePath }>,
    ) {
      state.builderMode = "CUSTOM";
      const group = getRuleGroupAtPath(
        getRuleGroup(state, action.payload.section),
        action.payload.path ?? [],
      );

      if (group) {
        group.conditions.push(createEmptyRuleGroup());
      }
    },
    updateCustomRuleConditionComparator(
      state,
      action: PayloadAction<{
        section: CustomRuleSection;
        path: RuleNodePath;
        comparator: ComparisonOperator;
      }>,
    ) {
      state.builderMode = "CUSTOM";
      const condition = getRuleNodeAtPath(
        getRuleGroup(state, action.payload.section),
        action.payload.path,
      );

      if (condition?.type === "condition") {
        condition.comparator = action.payload.comparator;
      }
    },
    updateCustomRuleConditionOperand(
      state,
      action: PayloadAction<{
        section: CustomRuleSection;
        path: RuleNodePath;
        side: "left" | "right";
        operand: RuleOperand;
      }>,
    ) {
      state.builderMode = "CUSTOM";
      const condition = getRuleNodeAtPath(
        getRuleGroup(state, action.payload.section),
        action.payload.path,
      );

      if (condition?.type === "condition") {
        condition[action.payload.side] = action.payload.operand;
      }
    },
    removeCustomRuleNode(
      state,
      action: PayloadAction<{ section: CustomRuleSection; path: RuleNodePath }>,
    ) {
      state.builderMode = "CUSTOM";
      const parentGroup = getParentRuleGroupAtPath(
        getRuleGroup(state, action.payload.section),
        action.payload.path,
      );
      const targetIndex = action.payload.path.at(-1);

      if (parentGroup && targetIndex !== undefined) {
        parentGroup.conditions.splice(targetIndex, 1);
      }
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
        strategyType: BuiltInStrategyType;
        parameters: Record<string, unknown>;
        riskSettings: RiskSettings;
        benchmark: string;
        name: string;
        tags: string[];
      }>,
    ) {
      return {
        ...action.payload,
        builderMode: "BUILT_IN",
        customStrategy: createEmptyCustomStrategyDraft(),
      };
    },
    resetBuilder() {
      return createInitialState();
    },
  },
});

export const {
  setTicker,
  setDateRange,
  setBuilderMode,
  setStrategyType,
  setCustomStrategyDraft,
  updateCustomStrategyMeta,
  addCustomIndicator,
  updateCustomIndicatorLabel,
  updateCustomIndicatorParam,
  removeCustomIndicator,
  updateCustomRuleGroupOperator,
  addCustomRuleCondition,
  addCustomRuleGroup,
  updateCustomRuleConditionComparator,
  updateCustomRuleConditionOperand,
  removeCustomRuleNode,
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

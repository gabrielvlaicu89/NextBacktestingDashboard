/**
 * Tests for zod validation schemas.
 */
import { describe, it, expect } from "vitest";
import {
  backtestRequestSchema,
  createCustomStrategyDefinitionSchema,
  customStrategyDraftSchema,
  customStrategyDefinitionSchema,
  createStrategySchema,
  riskSettingsSchema,
  strategyBuilderModeSchema,
  updateCustomStrategyDefinitionSchema,
  updateStrategySchema,
} from "@/lib/validations";

describe("riskSettingsSchema", () => {
  it("accepts valid defaults", () => {
    const result = riskSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.starting_capital).toBe(10_000);
      expect(result.data.position_sizing_mode).toBe("PERCENT_PORTFOLIO");
    }
  });

  it("rejects capital below 100", () => {
    const result = riskSettingsSchema.safeParse({ starting_capital: 50 });
    expect(result.success).toBe(false);
  });

  it("accepts nullable stop_loss_pct and take_profit_pct", () => {
    const result = riskSettingsSchema.safeParse({
      stop_loss_pct: null,
      take_profit_pct: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects stop_loss_pct above 100", () => {
    const result = riskSettingsSchema.safeParse({ stop_loss_pct: 150 });
    expect(result.success).toBe(false);
  });
});

describe("backtestRequestSchema", () => {
  const validPayload = {
    strategy_type: "MEAN_REVERSION",
    ticker: "SPY",
    date_from: "2024-01-01",
    date_to: "2024-12-31",
  };

  it("accepts a minimal valid payload", () => {
    const result = backtestRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.benchmark).toBe("SPY");
      expect(result.data.parameters).toEqual({});
    }
  });

  it("rejects missing ticker", () => {
    const { ticker, ...noTicker } = validPayload;
    void ticker;
    const result = backtestRequestSchema.safeParse(noTicker);
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = backtestRequestSchema.safeParse({
      ...validPayload,
      date_from: "01-01-2024",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid strategy_type", () => {
    const result = backtestRequestSchema.safeParse({
      ...validPayload,
      strategy_type: "INVALID_TYPE",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid strategy types", () => {
    for (const type of [
      "MEAN_REVERSION",
      "MA_CROSSOVER",
      "EARNINGS_DRIFT",
      "PAIRS_TRADING",
      "BUY_AND_HOLD",
    ]) {
      const result = backtestRequestSchema.safeParse({ ...validPayload, strategy_type: type });
      expect(result.success).toBe(true);
    }
  });

  it("rejects date_to before date_from", () => {
    const result = backtestRequestSchema.safeParse({
      ...validPayload,
      date_from: "2024-12-31",
      date_to: "2024-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages).toContain("End date must be after start date");
    }
  });

  it("rejects date_to equal to date_from", () => {
    const result = backtestRequestSchema.safeParse({
      ...validPayload,
      date_from: "2024-06-15",
      date_to: "2024-06-15",
    });
    expect(result.success).toBe(false);
  });

  it("reports date_to path for date range error", () => {
    const result = backtestRequestSchema.safeParse({
      ...validPayload,
      date_from: "2024-12-31",
      date_to: "2024-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const dateErr = result.error.errors.find((e) => e.message.includes("End date"));
      expect(dateErr?.path).toContain("date_to");
    }
  });
});

describe("createStrategySchema", () => {
  const validPayload = {
    name: "SPY Mean Reversion",
    type: "MEAN_REVERSION",
    ticker: "SPY",
    dateFrom: "2024-01-01",
    dateTo: "2024-12-31",
  };

  it("accepts valid payload with defaults", () => {
    const result = createStrategySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.benchmark).toBe("SPY");
      expect(result.data.tags).toEqual([]);
      expect(result.data.parameters).toEqual({});
    }
  });

  it("rejects empty name", () => {
    const result = createStrategySchema.safeParse({ ...validPayload, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    const result = createStrategySchema.safeParse({
      ...validPayload,
      name: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("accepts tags array", () => {
    const result = createStrategySchema.safeParse({
      ...validPayload,
      tags: ["momentum", "test"],
    });
    expect(result.success).toBe(true);
  });
});

describe("strategyBuilderModeSchema", () => {
  it("accepts both supported builder modes", () => {
    expect(strategyBuilderModeSchema.safeParse("BUILT_IN").success).toBe(true);
    expect(strategyBuilderModeSchema.safeParse("CUSTOM").success).toBe(true);
  });

  it("rejects unknown builder modes", () => {
    expect(strategyBuilderModeSchema.safeParse("LEGACY").success).toBe(false);
  });
});

describe("customStrategyDefinitionSchema", () => {
  const validDefinition = {
    version: 1 as const,
    name: "RSI and SMA Reversal",
    description: "Buys on RSI recovery with price above its moving average.",
    indicators: [
      {
        id: "rsi-1",
        indicatorId: "RSI",
        label: "RSI 14",
        params: { period: 14 },
      },
      {
        id: "sma-1",
        indicatorId: "SMA",
        label: "SMA 20",
        params: { period: 20 },
      },
    ],
    longEntry: {
      type: "group",
      operator: "AND" as const,
      conditions: [
        {
          type: "condition",
          left: { kind: "indicator", indicatorId: "rsi-1" },
          comparator: ">" as const,
          right: { kind: "constant", value: 30 },
        },
        {
          type: "condition",
          left: { kind: "price", field: "CLOSE" as const },
          comparator: ">=" as const,
          right: { kind: "indicator", indicatorId: "sma-1" },
        },
      ],
    },
    longExit: {
      type: "group",
      operator: "OR" as const,
      conditions: [
        {
          type: "condition",
          left: { kind: "indicator", indicatorId: "rsi-1" },
          comparator: ">=" as const,
          right: { kind: "constant", value: 70 },
        },
      ],
    },
    shortEntry: {
      type: "group",
      operator: "AND" as const,
      conditions: [
        {
          type: "condition",
          left: { kind: "indicator", indicatorId: "rsi-1" },
          comparator: "<" as const,
          right: { kind: "constant", value: 70 },
        },
      ],
    },
    shortExit: {
      type: "group",
      operator: "AND" as const,
      conditions: [
        {
          type: "condition",
          left: { kind: "indicator", indicatorId: "rsi-1" },
          comparator: "crosses_above" as const,
          right: { kind: "constant", value: 50 },
        },
      ],
    },
  };

  it("accepts a valid custom strategy definition", () => {
    const result = customStrategyDefinitionSchema.safeParse(validDefinition);
    expect(result.success).toBe(true);
  });

  it("rejects duplicate indicator ids", () => {
    const result = customStrategyDefinitionSchema.safeParse({
      ...validDefinition,
      indicators: [...validDefinition.indicators, { ...validDefinition.indicators[0] }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((error) => error.message.includes("Indicator IDs"))).toBe(true);
    }
  });

  it("rejects rules that reference unknown indicators", () => {
    const result = customStrategyDefinitionSchema.safeParse({
      ...validDefinition,
      longEntry: {
        type: "group",
        operator: "AND" as const,
        conditions: [
          {
            type: "condition",
            left: { kind: "indicator", indicatorId: "missing-indicator" },
            comparator: ">" as const,
            right: { kind: "constant", value: 30 },
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((error) => error.message.includes("unknown indicator"))).toBe(true);
    }
  });

  it("rejects empty rule groups", () => {
    const result = customStrategyDefinitionSchema.safeParse({
      ...validDefinition,
      shortExit: {
        type: "group",
        operator: "AND" as const,
        conditions: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects conditions that compare two constants", () => {
    const result = customStrategyDefinitionSchema.safeParse({
      ...validDefinition,
      shortExit: {
        type: "group",
        operator: "AND" as const,
        conditions: [
          {
            type: "condition",
            left: { kind: "constant", value: 10 },
            comparator: ">" as const,
            right: { kind: "constant", value: 5 },
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((error) => error.message.includes("constant values"))).toBe(true);
    }
  });

  it("accepts nested rule groups", () => {
    const result = customStrategyDefinitionSchema.safeParse({
      ...validDefinition,
      longEntry: {
        type: "group",
        operator: "AND" as const,
        conditions: [
          validDefinition.longEntry.conditions[0],
          {
            type: "group",
            operator: "OR" as const,
            conditions: [validDefinition.longEntry.conditions[1]],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });
});

describe("customStrategyDraftSchema", () => {
  it("accepts incomplete draft groups for persisted work-in-progress strategies", () => {
    const result = customStrategyDraftSchema.safeParse({
      version: 1,
      name: "Draft Strategy",
      description: "Still being built.",
      indicators: [],
      longEntry: { type: "group", operator: "AND", conditions: [] },
      longExit: { type: "group", operator: "AND", conditions: [] },
      shortEntry: { type: "group", operator: "AND", conditions: [] },
      shortExit: { type: "group", operator: "AND", conditions: [] },
    });

    expect(result.success).toBe(true);
  });

  it("still rejects unknown indicator references in drafts", () => {
    const result = customStrategyDraftSchema.safeParse({
      version: 1,
      name: "Broken Draft",
      description: "",
      indicators: [],
      longEntry: {
        type: "group",
        operator: "AND",
        conditions: [
          {
            type: "condition",
            left: { kind: "indicator", indicatorId: "missing" },
            comparator: ">",
            right: { kind: "constant", value: 10 },
          },
        ],
      },
      longExit: { type: "group", operator: "AND", conditions: [] },
      shortEntry: { type: "group", operator: "AND", conditions: [] },
      shortExit: { type: "group", operator: "AND", conditions: [] },
    });

    expect(result.success).toBe(false);
  });
});

describe("createCustomStrategyDefinitionSchema", () => {
  const validPayload = {
    definition: {
      version: 1 as const,
      name: "Saved Custom Strategy",
      description: "Custom strategy for persistence tests.",
      indicators: [
        {
          id: "sma-1",
          indicatorId: "SMA",
          label: "SMA 20",
          params: { period: 20 },
        },
      ],
      longEntry: {
        type: "group" as const,
        operator: "AND" as const,
        conditions: [
          {
            type: "condition" as const,
            left: { kind: "price" as const, field: "CLOSE" as const },
            comparator: ">" as const,
            right: { kind: "indicator" as const, indicatorId: "sma-1" },
          },
        ],
      },
      longExit: {
        type: "group" as const,
        operator: "AND" as const,
        conditions: [
          {
            type: "condition" as const,
            left: { kind: "price" as const, field: "CLOSE" as const },
            comparator: "<" as const,
            right: { kind: "indicator" as const, indicatorId: "sma-1" },
          },
        ],
      },
      shortEntry: {
        type: "group" as const,
        operator: "AND" as const,
        conditions: [
          {
            type: "condition" as const,
            left: { kind: "indicator" as const, indicatorId: "sma-1" },
            comparator: "<=" as const,
            right: { kind: "constant" as const, value: 10 },
          },
        ],
      },
      shortExit: {
        type: "group" as const,
        operator: "AND" as const,
        conditions: [
          {
            type: "condition" as const,
            left: { kind: "indicator" as const, indicatorId: "sma-1" },
            comparator: ">=" as const,
            right: { kind: "constant" as const, value: 90 },
          },
        ],
      },
    },
    tags: ["swing", "mean-reversion"],
  };

  it("accepts a valid create payload", () => {
    const result = createCustomStrategyDefinitionSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts an incomplete draft payload for saved custom strategies", () => {
    const result = createCustomStrategyDefinitionSchema.safeParse({
      definition: {
        version: 1,
        name: "Draft Only",
        description: "Saved before rules are complete.",
        indicators: [],
        longEntry: { type: "group", operator: "AND", conditions: [] },
        longExit: { type: "group", operator: "AND", conditions: [] },
        shortEntry: { type: "group", operator: "AND", conditions: [] },
        shortExit: { type: "group", operator: "AND", conditions: [] },
      },
    });

    expect(result.success).toBe(true);
  });

  it("defaults tags to an empty array", () => {
    const result = createCustomStrategyDefinitionSchema.safeParse({
      definition: validPayload.definition,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("rejects empty tags", () => {
    const result = createCustomStrategyDefinitionSchema.safeParse({
      ...validPayload,
      tags: ["valid", ""],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateCustomStrategyDefinitionSchema", () => {
  it("accepts a partial update with tags only", () => {
    const result = updateCustomStrategyDefinitionSchema.safeParse({
      tags: ["momentum"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a partial update with definition only", () => {
    const result = updateCustomStrategyDefinitionSchema.safeParse({
      definition: {
        version: 1,
        name: "Updated Custom Strategy",
        description: "Updated description",
        indicators: [],
        longEntry: {
          type: "group",
          operator: "AND",
          conditions: [
            {
              type: "condition",
              left: { kind: "price", field: "CLOSE" },
              comparator: ">",
              right: { kind: "constant", value: 100 },
            },
          ],
        },
        longExit: {
          type: "group",
          operator: "AND",
          conditions: [
            {
              type: "condition",
              left: { kind: "price", field: "CLOSE" },
              comparator: "<",
              right: { kind: "constant", value: 90 },
            },
          ],
        },
        shortEntry: {
          type: "group",
          operator: "AND",
          conditions: [
            {
              type: "condition",
              left: { kind: "price", field: "CLOSE" },
              comparator: "<",
              right: { kind: "constant", value: 80 },
            },
          ],
        },
        shortExit: {
          type: "group",
          operator: "AND",
          conditions: [
            {
              type: "condition",
              left: { kind: "price", field: "CLOSE" },
              comparator: ">",
              right: { kind: "constant", value: 85 },
            },
          ],
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid nested custom definitions on update", () => {
    const result = updateCustomStrategyDefinitionSchema.safeParse({
      definition: {
        version: 1,
        name: "Broken",
        description: "",
        indicators: [],
        longEntry: { type: "group", operator: "AND", conditions: [] },
        longExit: { type: "group", operator: "AND", conditions: [] },
        shortEntry: { type: "group", operator: "AND", conditions: [] },
        shortExit: { type: "group", operator: "AND", conditions: [] },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown indicator references on update even for drafts", () => {
    const result = updateCustomStrategyDefinitionSchema.safeParse({
      definition: {
        version: 1,
        name: "Broken",
        description: "",
        indicators: [],
        longEntry: {
          type: "group",
          operator: "AND",
          conditions: [
            {
              type: "condition",
              left: { kind: "indicator", indicatorId: "missing" },
              comparator: ">",
              right: { kind: "constant", value: 1 },
            },
          ],
        },
        longExit: { type: "group", operator: "AND", conditions: [] },
        shortEntry: { type: "group", operator: "AND", conditions: [] },
        shortExit: { type: "group", operator: "AND", conditions: [] },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("updateStrategySchema", () => {
  it("accepts a partial update (name only)", () => {
    const result = updateStrategySchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (no-op update)", () => {
    const result = updateStrategySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still validates individual fields when provided", () => {
    const result = updateStrategySchema.safeParse({ type: "INVALID" });
    expect(result.success).toBe(false);
  });
});

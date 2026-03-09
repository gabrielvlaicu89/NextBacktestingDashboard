/**
 * Tests for zod validation schemas.
 */
import { describe, it, expect } from "vitest";
import {
  backtestRequestSchema,
  createStrategySchema,
  updateStrategySchema,
  riskSettingsSchema,
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

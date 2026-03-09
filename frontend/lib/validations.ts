/**
 * Zod validation schemas for API payloads and form inputs.
 * Mirror the backend Pydantic models for consistent validation on both sides.
 */
import { z } from "zod";

// ── Shared constants ──────────────────────────────────────────────────────────

export const STRATEGY_TYPES = [
  "MEAN_REVERSION",
  "MA_CROSSOVER",
  "EARNINGS_DRIFT",
  "PAIRS_TRADING",
  "BUY_AND_HOLD",
] as const;

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

// ── Risk Settings ─────────────────────────────────────────────────────────────

export const riskSettingsSchema = z.object({
  starting_capital: z.number().min(100, "Minimum capital is $100").default(10_000),
  position_sizing_mode: z.enum(["FIXED_DOLLAR", "PERCENT_PORTFOLIO"]).default("PERCENT_PORTFOLIO"),
  position_size: z.number().positive("Must be positive").default(100),
  stop_loss_pct: z.number().min(0).max(100).nullable().default(null),
  take_profit_pct: z.number().min(0).nullable().default(null),
});

// ── Backtest Request (sent to FastAPI via proxy) ──────────────────────────────

export const backtestRequestSchema = z.object({
  strategy_type: z.enum(STRATEGY_TYPES),
  ticker: z.string().min(1, "Ticker is required").max(10),
  date_from: dateStringSchema,
  date_to: dateStringSchema,
  benchmark: z.string().min(1).default("SPY"),
  risk_settings: riskSettingsSchema.default({}),
  parameters: z.record(z.unknown()).default({}),
}).refine(
  (data) => data.date_to > data.date_from,
  { message: "End date must be after start date", path: ["date_to"] },
);

export type BacktestRequestInput = z.infer<typeof backtestRequestSchema>;

// ── Strategy CRUD ─────────────────────────────────────────────────────────────

export const createStrategySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: z.enum(STRATEGY_TYPES),
  ticker: z.string().min(1, "Ticker is required").max(10),
  benchmark: z.string().min(1).default("SPY"),
  dateFrom: dateStringSchema,
  dateTo: dateStringSchema,
  parameters: z.record(z.unknown()).default({}),
  riskSettings: riskSettingsSchema.default({}),
  tags: z.array(z.string()).default([]),
});

export type CreateStrategyInput = z.infer<typeof createStrategySchema>;

export const updateStrategySchema = createStrategySchema.partial();

export type UpdateStrategyInput = z.infer<typeof updateStrategySchema>;

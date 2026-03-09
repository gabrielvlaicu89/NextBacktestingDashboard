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

export const STRATEGY_BUILDER_MODES = ["BUILT_IN", "CUSTOM"] as const;

export const RULE_GROUP_OPERATORS = ["AND", "OR"] as const;

export const COMPARISON_OPERATORS = [
  ">",
  ">=",
  "<",
  "<=",
  "==",
  "crosses_above",
  "crosses_below",
] as const;

export const PRICE_FIELDS = ["OPEN", "HIGH", "LOW", "CLOSE", "VOLUME"] as const;

export const INDICATOR_OUTPUT_KEYS = [
  "value",
  "upper",
  "middle",
  "lower",
  "histogram",
] as const;

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");
const identifierSchema = z.string().min(1, "Identifier is required").max(100);

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

// ── Custom Strategy Definition ───────────────────────────────────────────────

export const strategyBuilderModeSchema = z.enum(STRATEGY_BUILDER_MODES);

export const indicatorParamValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const indicatorNodeSchema = z.object({
  id: identifierSchema,
  indicatorId: identifierSchema,
  label: z.string().min(1, "Indicator label is required").max(200),
  params: z.record(indicatorParamValueSchema),
});

export const priceOperandSchema = z.object({
  kind: z.literal("price"),
  field: z.enum(PRICE_FIELDS),
});

export const indicatorOperandSchema = z.object({
  kind: z.literal("indicator"),
  indicatorId: identifierSchema,
  output: z.enum(INDICATOR_OUTPUT_KEYS).optional(),
});

export const constantOperandSchema = z.object({
  kind: z.literal("constant"),
  value: z.number().finite("Constant values must be finite"),
});

export const ruleOperandSchema = z.discriminatedUnion("kind", [
  priceOperandSchema,
  indicatorOperandSchema,
  constantOperandSchema,
]);

const ruleConditionSchema = z
  .object({
    type: z.literal("condition"),
    left: ruleOperandSchema,
    comparator: z.enum(COMPARISON_OPERATORS),
    right: ruleOperandSchema,
  })
  .superRefine((condition, ctx) => {
    if (condition.left.kind === "constant" && condition.right.kind === "constant") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A rule condition cannot compare two constant values.",
        path: ["right"],
      });
    }
  });

type RuleNodeInput =
  | z.infer<typeof ruleConditionSchema>
  | {
      type: "group";
      operator: (typeof RULE_GROUP_OPERATORS)[number];
      conditions: RuleNodeInput[];
    };

type RuleNodeDraftInput =
  | z.infer<typeof ruleConditionSchema>
  | {
      type: "group";
      operator: (typeof RULE_GROUP_OPERATORS)[number];
      conditions: RuleNodeDraftInput[];
    };

const ruleNodeSchema: z.ZodType<RuleNodeInput> = z.lazy(() =>
  z.union([ruleConditionSchema, ruleGroupSchema]),
);

export const ruleGroupSchema: z.ZodType<Extract<RuleNodeInput, { type: "group" }>> = z.lazy(
  () =>
    z.object({
      type: z.literal("group"),
      operator: z.enum(RULE_GROUP_OPERATORS),
      conditions: z
        .array(ruleNodeSchema)
        .min(1, "Rule groups must contain at least one condition."),
    }),
);

const ruleDraftNodeSchema: z.ZodType<RuleNodeDraftInput> = z.lazy(() =>
  z.union([ruleConditionSchema, ruleDraftGroupSchema]),
);

export const ruleDraftGroupSchema: z.ZodType<
  Extract<RuleNodeDraftInput, { type: "group" }>
> = z.lazy(() =>
  z.object({
    type: z.literal("group"),
    operator: z.enum(RULE_GROUP_OPERATORS),
    conditions: z.array(ruleDraftNodeSchema),
  }),
);

function collectIndicatorReferences(node: RuleNodeInput): string[] {
  if (node.type === "condition") {
    return [node.left, node.right]
      .filter((operand) => operand.kind === "indicator")
      .map((operand) => operand.indicatorId);
  }

  return node.conditions.flatMap((child) => collectIndicatorReferences(child));
}

export const customStrategyDefinitionSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(1000).default(""),
    indicators: z.array(indicatorNodeSchema),
    longEntry: ruleGroupSchema,
    longExit: ruleGroupSchema,
    shortEntry: ruleGroupSchema,
    shortExit: ruleGroupSchema,
  })
  .superRefine((definition, ctx) => {
    const indicatorIds = definition.indicators.map((indicator) => indicator.id);
    const uniqueIndicatorIds = new Set(indicatorIds);

    if (uniqueIndicatorIds.size !== indicatorIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indicator IDs must be unique within a custom strategy definition.",
        path: ["indicators"],
      });
    }

    const referencedIndicatorIds = [
      ...collectIndicatorReferences(definition.longEntry),
      ...collectIndicatorReferences(definition.longExit),
      ...collectIndicatorReferences(definition.shortEntry),
      ...collectIndicatorReferences(definition.shortExit),
    ];

    referencedIndicatorIds.forEach((indicatorId) => {
      if (!uniqueIndicatorIds.has(indicatorId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Rules reference unknown indicator '${indicatorId}'.`,
          path: ["indicators"],
        });
      }
    });
  });

export type CustomStrategyDefinitionInput = z.infer<typeof customStrategyDefinitionSchema>;

export const customStrategyDraftSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(1000).default(""),
    indicators: z.array(indicatorNodeSchema),
    longEntry: ruleDraftGroupSchema,
    longExit: ruleDraftGroupSchema,
    shortEntry: ruleDraftGroupSchema,
    shortExit: ruleDraftGroupSchema,
  })
  .superRefine((definition, ctx) => {
    const indicatorIds = definition.indicators.map((indicator) => indicator.id);
    const uniqueIndicatorIds = new Set(indicatorIds);

    if (uniqueIndicatorIds.size !== indicatorIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indicator IDs must be unique within a custom strategy definition.",
        path: ["indicators"],
      });
    }

    const referencedIndicatorIds = [
      ...collectIndicatorReferences(definition.longEntry),
      ...collectIndicatorReferences(definition.longExit),
      ...collectIndicatorReferences(definition.shortEntry),
      ...collectIndicatorReferences(definition.shortExit),
    ];

    referencedIndicatorIds.forEach((indicatorId) => {
      if (!uniqueIndicatorIds.has(indicatorId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Rules reference unknown indicator '${indicatorId}'.`,
          path: ["indicators"],
        });
      }
    });
  });

export type CustomStrategyDraftInput = z.infer<typeof customStrategyDraftSchema>;

export const createCustomStrategyDefinitionSchema = z.object({
  definition: customStrategyDraftSchema,
  tags: z.array(z.string().min(1).max(50)).default([]),
});

export const updateCustomStrategyDefinitionSchema = z.object({
  definition: customStrategyDraftSchema.optional(),
  tags: z.array(z.string().min(1).max(50)).optional(),
});

export type CreateCustomStrategyDefinitionInput = z.infer<
  typeof createCustomStrategyDefinitionSchema
>;

export type UpdateCustomStrategyDefinitionInput = z.infer<
  typeof updateCustomStrategyDefinitionSchema
>;

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

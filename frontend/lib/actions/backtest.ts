"use server";

/**
 * Server action to create a Strategy + BacktestRun pair in Prisma.
 *
 * Returns { strategyId, runId } so the client can connect to the SSE stream.
 * The actual backtest execution is handled by GET /api/backtest?runId=...
 */
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { backtestRequestSchema } from "@/lib/validations";
import { Prisma } from "@/app/generated/prisma/client";

export interface CreateRunResult {
  strategyId: string;
  runId: string;
}

export async function createBacktestRun(input: {
  name?: string;
  tags?: string[];
  strategy_type: string;
  ticker: string;
  date_from: string;
  date_to: string;
  benchmark?: string;
  risk_settings?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}): Promise<CreateRunResult> {
  const user = await requireCurrentUser();

  // Validate the backtest-specific fields
  const parsed = backtestRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.flatten().fieldErrors}`);
  }

  const { strategy_type, ticker, date_from, date_to, benchmark, risk_settings, parameters } =
    parsed.data;

  const strategyName = input.name || `${ticker} ${strategy_type.replace(/_/g, " ")}`;

  const strategy = await prisma.strategy.create({
    data: {
      userId: user.id,
      name: strategyName,
      type: strategy_type,
      ticker,
      benchmark,
      dateFrom: new Date(date_from),
      dateTo: new Date(date_to),
      parameters: (parameters ?? {}) as Prisma.InputJsonValue,
      riskSettings: (risk_settings ?? {}) as Prisma.InputJsonValue,
      tags: input.tags ?? [],
    },
  });

  const run = await prisma.backtestRun.create({
    data: {
      strategyId: strategy.id,
      userId: user.id,
      status: "PENDING",
    },
  });

  return { strategyId: strategy.id, runId: run.id };
}

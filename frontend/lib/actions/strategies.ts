"use server";

/**
 * Server actions for Strategy CRUD.
 *
 * These query Prisma directly (no intermediate API call) and are designed
 * to be called from Client Components via React's server action mechanism,
 * or from Server Components directly.
 */
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { createStrategySchema, updateStrategySchema } from "@/lib/validations";
import type { StrategyWithRuns, StrategyRecord } from "@/lib/types";
import { Prisma } from "@/app/generated/prisma/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function serialiseStrategy(s: {
  id: string;
  userId: string;
  name: string;
  type: string;
  ticker: string;
  benchmark: string;
  dateFrom: Date;
  dateTo: Date;
  parameters: unknown;
  riskSettings: unknown;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}): StrategyRecord {
  return {
    ...s,
    type: s.type as StrategyRecord["type"],
    dateFrom: s.dateFrom.toISOString(),
    dateTo: s.dateTo.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    parameters: s.parameters as Record<string, unknown>,
    riskSettings: s.riskSettings as StrategyRecord["riskSettings"],
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function getStrategies(): Promise<StrategyWithRuns[]> {
  const user = await requireCurrentUser();

  const strategies = await prisma.strategy.findMany({
    where: { userId: user.id },
    include: { runs: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return strategies.map((s) => ({
    ...serialiseStrategy(s),
    runs: s.runs.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      results: r.results as StrategyWithRuns["runs"][number]["results"],
    })),
  }));
}

export async function getStrategy(id: string): Promise<StrategyWithRuns | null> {
  const user = await requireCurrentUser();

  const strategy = await prisma.strategy.findUnique({
    where: { id },
    include: { runs: { orderBy: { createdAt: "desc" } } },
  });

  if (!strategy || strategy.userId !== user.id) return null;

  return {
    ...serialiseStrategy(strategy),
    runs: strategy.runs.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      results: r.results as StrategyWithRuns["runs"][number]["results"],
    })),
  };
}

export async function createStrategy(input: unknown): Promise<StrategyRecord> {
  const user = await requireCurrentUser();

  const parsed = createStrategySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }

  const { name, type, ticker, benchmark, dateFrom, dateTo, parameters, riskSettings, tags } =
    parsed.data;

  const strategy = await prisma.strategy.create({
    data: {
      userId: user.id,
      name,
      type,
      ticker,
      benchmark,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      parameters: parameters as Prisma.InputJsonValue,
      riskSettings: riskSettings as Prisma.InputJsonValue,
      tags,
    },
  });

  revalidatePath("/dashboard");
  return serialiseStrategy(strategy);
}

export async function updateStrategy(id: string, input: unknown): Promise<StrategyRecord> {
  const user = await requireCurrentUser();

  const existing = await prisma.strategy.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    throw new Error("Strategy not found or forbidden");
  }

  const parsed = updateStrategySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }

  const { dateFrom, dateTo, parameters, riskSettings, ...rest } = parsed.data;

  // Cast parameters/riskSettings for Prisma Json fields
  const data = {
    ...rest,
    ...(parameters !== undefined
      ? { parameters: parameters as Prisma.InputJsonValue }
      : {}),
    ...(riskSettings !== undefined
      ? { riskSettings: riskSettings as Prisma.InputJsonValue }
      : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
  };

  const updated = await prisma.strategy.update({
    where: { id },
    data,
  });

  revalidatePath("/dashboard");
  return serialiseStrategy(updated);
}

export async function deleteStrategy(id: string): Promise<void> {
  const user = await requireCurrentUser();

  const existing = await prisma.strategy.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    throw new Error("Strategy not found or forbidden");
  }

  await prisma.strategy.delete({ where: { id } });
  revalidatePath("/dashboard");
}

export async function getStrategiesByIds(ids: string[]): Promise<StrategyWithRuns[]> {
  if (ids.length === 0) return [];
  const user = await requireCurrentUser();

  const strategies = await prisma.strategy.findMany({
    where: { id: { in: ids }, userId: user.id },
    include: { runs: { orderBy: { createdAt: "desc" } } },
  });

  // Preserve the input ID order for stable rendering
  const byId = Object.fromEntries(strategies.map((s) => [s.id, s]));
  return ids
    .map((id) => byId[id])
    .filter(Boolean)
    .map((s) => ({
      ...serialiseStrategy(s),
      runs: s.runs.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        results: r.results as StrategyWithRuns["runs"][number]["results"],
      })),
    }));
}

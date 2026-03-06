"use server";

/**
 * Server actions for Strategy CRUD.
 *
 * These query Prisma directly (no intermediate API call) and are designed
 * to be called from Client Components via React's server action mechanism,
 * or from Server Components directly.
 */
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStrategySchema, updateStrategySchema } from "@/lib/validations";
import type { StrategyWithRuns, StrategyRecord } from "@/lib/types";

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
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const strategies = await prisma.strategy.findMany({
    where: { userId: session.user.id },
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
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const strategy = await prisma.strategy.findUnique({
    where: { id },
    include: { runs: { orderBy: { createdAt: "desc" } } },
  });

  if (!strategy || strategy.userId !== session.user.id) return null;

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
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = createStrategySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }

  const { name, type, ticker, benchmark, dateFrom, dateTo, parameters, riskSettings, tags } =
    parsed.data;

  const strategy = await prisma.strategy.create({
    data: {
      userId: session.user.id,
      name,
      type,
      ticker,
      benchmark,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      parameters,
      riskSettings,
      tags,
    },
  });

  revalidatePath("/dashboard");
  return serialiseStrategy(strategy);
}

export async function updateStrategy(id: string, input: unknown): Promise<StrategyRecord> {
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await prisma.strategy.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    throw new Error("Strategy not found or forbidden");
  }

  const parsed = updateStrategySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }

  const { dateFrom, dateTo, ...rest } = parsed.data;

  const updated = await prisma.strategy.update({
    where: { id },
    data: {
      ...rest,
      ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
      ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
    },
  });

  revalidatePath("/dashboard");
  return serialiseStrategy(updated);
}

export async function deleteStrategy(id: string): Promise<void> {
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const existing = await prisma.strategy.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    throw new Error("Strategy not found or forbidden");
  }

  await prisma.strategy.delete({ where: { id } });
  revalidatePath("/dashboard");
}

export async function getStrategiesByIds(ids: string[]): Promise<StrategyWithRuns[]> {
  if (ids.length === 0) return [];
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const strategies = await prisma.strategy.findMany({
    where: { id: { in: ids }, userId: session.user.id },
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

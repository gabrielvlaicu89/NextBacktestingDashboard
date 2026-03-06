/**
 * /api/strategies/[id]
 *
 * GET    — Fetch a single strategy + its backtest runs
 * PATCH  — Update strategy fields
 * DELETE — Delete a strategy (cascades to its runs)
 */
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStrategySchema } from "@/lib/validations";
import { Prisma } from "@/app/generated/prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ── GET /api/strategies/[id] ─────────────────────────────────────────────────

export async function GET(_req: Request, context: RouteContext) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const strategy = await prisma.strategy.findUnique({
    where: { id },
    include: { runs: { orderBy: { createdAt: "desc" } } },
  });

  if (!strategy) {
    return Response.json({ error: "Strategy not found" }, { status: 404 });
  }

  if (strategy.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json({
    ...strategy,
    dateFrom: strategy.dateFrom.toISOString(),
    dateTo: strategy.dateTo.toISOString(),
    createdAt: strategy.createdAt.toISOString(),
    updatedAt: strategy.updatedAt.toISOString(),
    runs: strategy.runs.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

// ── PATCH /api/strategies/[id] ───────────────────────────────────────────────

export async function PATCH(req: Request, context: RouteContext) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.strategy.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Strategy not found" }, { status: 404 });
  }
  if (existing.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateStrategySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
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

  return Response.json({
    ...updated,
    dateFrom: updated.dateFrom.toISOString(),
    dateTo: updated.dateTo.toISOString(),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

// ── DELETE /api/strategies/[id] ──────────────────────────────────────────────

export async function DELETE(_req: Request, context: RouteContext) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.strategy.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Strategy not found" }, { status: 404 });
  }
  if (existing.userId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.strategy.delete({ where: { id } });

  return Response.json({ success: true });
}

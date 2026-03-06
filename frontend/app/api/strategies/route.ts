/**
 * /api/strategies
 *
 * GET  — List all strategies for the authenticated user
 * POST — Create a new strategy
 */
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStrategySchema } from "@/lib/validations";
import { Prisma } from "@/app/generated/prisma/client";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const strategies = await prisma.strategy.findMany({
    where: { userId: session.user.id },
    include: { runs: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  // Serialise dates to ISO strings for JSON transport
  const serialised = strategies.map((s) => ({
    ...s,
    dateFrom: s.dateFrom.toISOString(),
    dateTo: s.dateTo.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    runs: s.runs.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  }));

  return Response.json(serialised);
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createStrategySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
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
      parameters: parameters as Prisma.InputJsonValue,
      riskSettings: riskSettings as Prisma.InputJsonValue,
      tags,
    },
  });

  return Response.json(
    {
      ...strategy,
      dateFrom: strategy.dateFrom.toISOString(),
      dateTo: strategy.dateTo.toISOString(),
      createdAt: strategy.createdAt.toISOString(),
      updatedAt: strategy.updatedAt.toISOString(),
    },
    { status: 201 },
  );
}

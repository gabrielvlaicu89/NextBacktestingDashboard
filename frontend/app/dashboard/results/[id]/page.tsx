/**
 * app/dashboard/results/[id]/page.tsx — Server Component
 *
 * Fetches a specific backtest run by ID, verifies ownership, then renders the
 * ResultsDashboard client component with that saved run's results.
 */
import { notFound } from "next/navigation";
import { ResultsDashboard } from "@/components/results/results-dashboard";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import type { BacktestResponse, RiskSettings, StrategyWithRuns } from "@/lib/types";

interface ResultsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params;
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    notFound();
  }

  const run = await prisma.backtestRun.findUnique({
    where: { id },
    include: {
      strategy: {
        include: {
          runs: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!run || run.userId !== user.id) {
    notFound();
  }

  const strategy: StrategyWithRuns = {
    ...run.strategy,
    dateFrom: run.strategy.dateFrom.toISOString(),
    dateTo: run.strategy.dateTo.toISOString(),
    createdAt: run.strategy.createdAt.toISOString(),
    updatedAt: run.strategy.updatedAt.toISOString(),
    parameters: run.strategy.parameters as Record<string, unknown>,
    riskSettings: run.strategy.riskSettings as unknown as RiskSettings,
    runs: run.strategy.runs.map((strategyRun) => ({
      ...strategyRun,
      createdAt: strategyRun.createdAt.toISOString(),
      results: strategyRun.results as BacktestResponse | null,
    })),
  };

  return (
    <div className="p-6">
      <ResultsDashboard
        strategy={strategy}
        savedResults={run.results as BacktestResponse | null}
        strategyId={strategy.id}
      />
    </div>
  );
}

/**
 * app/dashboard/results/[id]/page.tsx — Server Component
 *
 * Fetches a specific strategy + its latest backtest run by ID,
 * then renders the ResultsDashboard client component with pre-loaded data.
 */
import { notFound } from "next/navigation";
import { getStrategy } from "@/lib/actions/strategies";
import { ResultsDashboard } from "@/components/results/results-dashboard";
import type { BacktestResponse } from "@/lib/types";

interface ResultsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params;

  let strategy;
  try {
    strategy = await getStrategy(id);
  } catch {
    notFound();
  }

  if (!strategy) {
    notFound();
  }

  // Find the latest completed run's results
  const latestRun = strategy.runs.find((r) => r.status === "COMPLETED");
  const savedResults: BacktestResponse | null = latestRun?.results ?? null;

  return (
    <div className="p-6">
      <ResultsDashboard
        strategy={strategy}
        savedResults={savedResults}
        strategyId={strategy.id}
      />
    </div>
  );
}

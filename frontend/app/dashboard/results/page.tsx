/**
 * app/dashboard/results/page.tsx — shows live backtest results from Redux.
 *
 * This is used when the user runs a backtest from the Strategy Builder.
 * For historical run results, use /dashboard/results/[id] instead.
 */
import { ResultsDashboard } from "@/components/results/results-dashboard";

export default function LiveResultsPage() {
  return (
    <div className="p-6">
      <ResultsDashboard />
    </div>
  );
}

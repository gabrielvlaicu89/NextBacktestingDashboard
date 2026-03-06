import { StrategyBuilderForm } from "@/components/strategy-builder/strategy-builder-form";
import { getStrategies } from "@/lib/actions/strategies";

export default async function NewBacktestPage() {
  let showOnboarding = false;
  try {
    const strategies = await getStrategies();
    showOnboarding = strategies.length === 0;
  } catch {
    // If fetching fails (e.g., no DB connection), skip onboarding
    showOnboarding = false;
  }

  return <StrategyBuilderForm showOnboarding={showOnboarding} />;
}

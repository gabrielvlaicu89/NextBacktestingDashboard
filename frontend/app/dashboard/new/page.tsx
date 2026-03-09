import { StrategyBuilderForm } from "@/components/strategy-builder/strategy-builder-form";
import { SavedCustomStrategiesSection } from "@/components/custom-strategy/saved-custom-strategies-section";
import { getCustomStrategyDefinitions } from "@/lib/actions/custom-strategy-definitions";
import { getStrategies } from "@/lib/actions/strategies";
import type { CustomStrategyDefinitionRecord } from "@/lib/types";

export default async function NewBacktestPage() {
  let showOnboarding = false;
  let customDefinitions: CustomStrategyDefinitionRecord[] = [];
  try {
    const strategies = await getStrategies();
    showOnboarding = strategies.length === 0;
  } catch {
    // If fetching fails (e.g., no DB connection), skip onboarding
    showOnboarding = false;
  }

  try {
    customDefinitions = await getCustomStrategyDefinitions();
  } catch {
    customDefinitions = [];
  }

  return (
    <div className="space-y-10">
      <StrategyBuilderForm showOnboarding={showOnboarding} />
      <SavedCustomStrategiesSection definitions={customDefinitions} />
    </div>
  );
}

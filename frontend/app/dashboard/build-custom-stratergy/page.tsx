import { CustomStrategyBuilderWorkspace } from "@/components/custom-strategy/custom-strategy-builder-workspace";
import {
  getCustomStrategyDefinition,
  getCustomStrategyDefinitions,
} from "@/lib/actions/custom-strategy-definitions";
import type { CustomStrategyDefinitionRecord } from "@/lib/types";

interface BuildCustomStrategyPageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function BuildCustomStrategyPage({
  searchParams,
}: BuildCustomStrategyPageProps) {
  const { id } = await searchParams;

  const definitions: CustomStrategyDefinitionRecord[] =
    await getCustomStrategyDefinitions();

  let initialDefinition: CustomStrategyDefinitionRecord | null = null;
  if (id) {
    initialDefinition = definitions.find((definition) => definition.id === id) ?? null;

    if (!initialDefinition) {
      initialDefinition = await getCustomStrategyDefinition(id);
    }
  }

  return (
    <CustomStrategyBuilderWorkspace
      initialDefinitions={definitions}
      initialDefinition={initialDefinition}
    />
  );
}
"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomStrategyDefinitionRecord } from "@/lib/types";
import { useAppDispatch } from "@/store/hooks";
import {
  setCustomStrategyDraft,
  setName,
  setTags,
} from "@/store/slices/strategyBuilderSlice";

interface SavedCustomStrategyLaunchButtonProps {
  definition: CustomStrategyDefinitionRecord;
}

export function SavedCustomStrategyLaunchButton({
  definition,
}: SavedCustomStrategyLaunchButtonProps) {
  const dispatch = useAppDispatch();

  const handleLaunch = () => {
    dispatch(setCustomStrategyDraft(definition.definition));
    dispatch(setName(definition.name));
    dispatch(setTags(definition.tags));

    if (typeof document === "undefined") {
      return;
    }

    const form = document.querySelector<HTMLElement>(
      '[data-testid="strategy-builder-form"]',
    );
    form?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return (
    <Button
      type="button"
      variant="default"
      onClick={handleLaunch}
      data-testid={`launch-custom-strategy-${definition.id}`}
    >
      <Play className="h-4 w-4" />
      Review Runtime Config
    </Button>
  );
}
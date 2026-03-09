"use client";

/**
 * StrategyTypeSelector — card-based picker showing all strategy types.
 *
 * Displays each strategy as a selectable card with label + description.
 * Selecting a card dispatches setStrategyType, which also resets parameters.
 */
import { cn } from "@/lib/utils";
import { STRATEGY_CATALOG } from "@/lib/strategy-catalog";
import type { BuiltInStrategyType } from "@/lib/types";
import { Label } from "@/components/ui/label";

interface StrategyTypeSelectorProps {
  value: BuiltInStrategyType | null;
  onChange: (type: BuiltInStrategyType) => void;
  disabled?: boolean;
}

export function StrategyTypeSelector({
  value,
  onChange,
  disabled = false,
}: StrategyTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label>Strategy Type</Label>
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        role="radiogroup"
        aria-label="Strategy type"
      >
        {STRATEGY_CATALOG.map((item) => {
          const isSelected = value === item.type;
          return (
            <button
              key={item.type}
              type="button"
              disabled={disabled}
              role="radio"
              aria-checked={isSelected}
              data-testid={`strategy-card-${item.type}`}
              onClick={() => onChange(item.type)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border"
              )}
            >
              <h4 className="text-sm font-semibold">{item.label}</h4>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

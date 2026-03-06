"use client";

/**
 * StrategyParamsForm — renders dynamic form fields based on the selected strategy type.
 *
 * Reads the parameter schema from the strategy catalog and renders appropriate
 * input controls (number, select, ticker search).
 */
import { getCatalogItem } from "@/lib/strategy-catalog";
import type { StrategyType } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TickerSearch } from "@/components/strategy-builder/ticker-search";

interface StrategyParamsFormProps {
  strategyType: StrategyType | null;
  parameters: Record<string, unknown>;
  onParameterChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}

export function StrategyParamsForm({
  strategyType,
  parameters,
  onParameterChange,
  disabled = false,
}: StrategyParamsFormProps) {
  if (!strategyType) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="no-strategy-msg">
        Select a strategy type to configure parameters.
      </p>
    );
  }

  const catalogItem = getCatalogItem(strategyType);
  if (!catalogItem) return null;

  if (catalogItem.params.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="no-params-msg">
        {catalogItem.label} has no configurable parameters.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="strategy-params-form">
      {catalogItem.params.map((param) => {
        const currentValue = parameters[param.key] ?? param.default ?? "";

        if (param.type === "number") {
          return (
            <div key={param.key} className="space-y-2">
              <Label htmlFor={`param-${param.key}`}>{param.label}</Label>
              <Input
                id={`param-${param.key}`}
                type="number"
                min={param.min}
                max={param.max}
                step={param.step ?? 1}
                value={currentValue as number}
                disabled={disabled}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : Number(e.target.value);
                  onParameterChange(param.key, val);
                }}
                data-testid={`param-${param.key}`}
              />
            </div>
          );
        }

        if (param.type === "select" && param.options) {
          return (
            <div key={param.key} className="space-y-2">
              <Label htmlFor={`param-${param.key}`}>{param.label}</Label>
              <Select
                value={String(currentValue)}
                onValueChange={(val: string) => onParameterChange(param.key, val)}
                disabled={disabled}
              >
                <SelectTrigger
                  id={`param-${param.key}`}
                  data-testid={`param-${param.key}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {param.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (param.type === "ticker") {
          return (
            <div key={param.key} className="space-y-2">
              <TickerSearch
                label={param.label}
                value={String(currentValue ?? "")}
                onChange={(ticker) => onParameterChange(param.key, ticker)}
                disabled={disabled}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

"use client";

/**
 * OptimizeConfigForm — lets the user configure which numeric parameters to sweep
 * and what metric to optimize for.
 *
 * For each "number" type param: shows Min / Max / Step inputs.
 * For "select" and "ticker" params: shows the current (fixed) value as read-only.
 * On submit, calls onSubmit(config) with a fully-formed OptimizeConfig.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPTIMIZE_METRICS } from "@/lib/types";
import type { OptimizeConfig, ParamRange, StrategyWithRuns } from "@/lib/types";
import type { StrategyCatalogItem } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParamRangeState {
  min: string;
  max: string;
  step: string;
}

interface OptimizeConfigFormProps {
  strategy: StrategyWithRuns;
  catalog: StrategyCatalogItem;
  onSubmit: (config: OptimizeConfig) => void;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OptimizeConfigForm({
  strategy,
  catalog,
  onSubmit,
  disabled = false,
}: OptimizeConfigFormProps) {
  const numericParams = catalog.params.filter((p) => p.type === "number");
  const fixedParams = catalog.params.filter(
    (p) => p.type !== "number",
  );

  // State for each numeric param's range
  const [ranges, setRanges] = useState<Record<string, ParamRangeState>>(() => {
    const init: Record<string, ParamRangeState> = {};
    for (const p of numericParams) {
      const currentVal =
        typeof strategy.parameters[p.key] === "number"
          ? (strategy.parameters[p.key] as number)
          : (p.default as number | undefined) ?? 0;
      const step = p.step ?? 1;
      // Default range: ±2 steps around the current value
      init[p.key] = {
        min: String(Math.max(p.min ?? 0, currentVal - step * 2)),
        max: String(currentVal + step * 2),
        step: String(step),
      };
    }
    return init;
  });

  const [optimizeFor, setOptimizeFor] = useState("sharpe_ratio");

  const updateRange = (paramKey: string, field: keyof ParamRangeState, value: string) => {
    setRanges((prev) => ({
      ...prev,
      [paramKey]: { ...prev[paramKey], [field]: value },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build param_ranges from the range inputs
    const param_ranges: Record<string, ParamRange> = {};
    for (const p of numericParams) {
      const r = ranges[p.key];
      const min = parseFloat(r.min);
      const max = parseFloat(r.max);
      const step = parseFloat(r.step);

      if (isNaN(min) || isNaN(max) || isNaN(step) || step <= 0 || min > max) {
        continue; // skip invalid ranges
      }
      param_ranges[p.key] = { min, max, step };
    }

    // Build fixed_parameters for non-numeric params
    const fixed_parameters: Record<string, unknown> = {};
    for (const p of fixedParams) {
      if (strategy.parameters[p.key] !== undefined) {
        fixed_parameters[p.key] = strategy.parameters[p.key];
      } else if (p.default !== undefined) {
        fixed_parameters[p.key] = p.default;
      }
    }

    const config: OptimizeConfig = {
      strategy_type: strategy.type,
      ticker: strategy.ticker,
      date_from: strategy.dateFrom.split("T")[0],
      date_to: strategy.dateTo.split("T")[0],
      benchmark: strategy.benchmark,
      risk_settings: strategy.riskSettings,
      fixed_parameters,
      param_ranges,
      optimize_for: optimizeFor,
    };

    onSubmit(config);
  };

  return (
    <form
      data-testid="optimize-config-form"
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Fixed params (read-only info) */}
      {fixedParams.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            Fixed Parameters (not swept)
          </p>
          <div className="space-y-2">
            {fixedParams.map((p) => (
              <div key={p.key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-medium">
                  {String(strategy.parameters[p.key] ?? p.default ?? "—")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Numeric param ranges */}
      {numericParams.length > 0 ? (
        <div className="space-y-5">
          <p className="text-sm font-medium">Parameter Ranges to Sweep</p>
          {numericParams.map((p) => (
            <div
              key={p.key}
              data-testid={`param-range-${p.key}`}
              className="rounded-lg border p-4"
            >
              <p className="mb-3 text-sm font-semibold">{p.label}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor={`${p.key}-min`} className="text-xs">
                    Min
                  </Label>
                  <Input
                    id={`${p.key}-min`}
                    type="number"
                    value={ranges[p.key]?.min ?? ""}
                    onChange={(e) => updateRange(p.key, "min", e.target.value)}
                    step={p.step ?? 1}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <Label htmlFor={`${p.key}-max`} className="text-xs">
                    Max
                  </Label>
                  <Input
                    id={`${p.key}-max`}
                    type="number"
                    value={ranges[p.key]?.max ?? ""}
                    onChange={(e) => updateRange(p.key, "max", e.target.value)}
                    step={p.step ?? 1}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <Label htmlFor={`${p.key}-step`} className="text-xs">
                    Step
                  </Label>
                  <Input
                    id={`${p.key}-step`}
                    type="number"
                    value={ranges[p.key]?.step ?? ""}
                    onChange={(e) => updateRange(p.key, "step", e.target.value)}
                    step={p.step ?? 1}
                    min={0.001}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          This strategy has no numeric parameters to optimize. Try a different
          strategy type.
        </p>
      )}

      {/* Metric to optimize */}
      <div>
        <Label htmlFor="optimize-for" className="text-sm font-medium">
          Optimize For
        </Label>
        <Select value={optimizeFor} onValueChange={setOptimizeFor}>
          <SelectTrigger
            id="optimize-for"
            className="mt-1"
            aria-label="Optimize for metric"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIMIZE_METRICS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        disabled={disabled || numericParams.length === 0}
        className="w-full"
      >
        {disabled ? "Optimizing…" : "Run Optimization"}
      </Button>
    </form>
  );
}

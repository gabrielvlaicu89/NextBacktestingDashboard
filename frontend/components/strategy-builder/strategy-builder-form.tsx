"use client";

/**
 * StrategyBuilderForm — client component that assembles all strategy builder
 * sub-components and wires them to the Redux store.
 */
import { useCallback, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setTicker,
  setDateRange,
  setStrategyType,
  setParameter,
  setRiskSettings,
  setBenchmark,
  setName,
  resetBuilder,
} from "@/store/slices/strategyBuilderSlice";
import { useBacktestStream } from "@/hooks/useBacktestStream";
import { backtestRequestSchema } from "@/lib/validations";
import type { StrategyType } from "@/lib/types";

import { TickerSearch } from "@/components/strategy-builder/ticker-search";
import { DateRangePicker } from "@/components/strategy-builder/date-range-picker";
import { StrategyTypeSelector } from "@/components/strategy-builder/strategy-type-selector";
import { StrategyParamsForm } from "@/components/strategy-builder/strategy-params-form";
import { RiskSettingsForm } from "@/components/strategy-builder/risk-settings-form";
import { BenchmarkSelector } from "@/components/strategy-builder/benchmark-selector";
import { RunButton } from "@/components/strategy-builder/run-button";
import { OnboardingModal } from "@/components/strategy-builder/onboarding-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function StrategyBuilderForm({
  showOnboarding = false,
}: {
  showOnboarding?: boolean;
}) {
  const dispatch = useAppDispatch();
  const builder = useAppSelector((s: import("@/store/store").RootState) => s.strategyBuilder);
  const backtestStatus = useAppSelector((s: import("@/store/store").RootState) => s.backtest.status);
  const { startBacktest } = useBacktestStream();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [onboardingOpen, setOnboardingOpen] = useState(showOnboarding);

  const isRunning = backtestStatus === "running";

  const handleRun = useCallback(async () => {
    setFieldErrors({});

    // Validate form state
    const payload = {
      strategy_type: builder.strategyType,
      ticker: builder.ticker,
      date_from: builder.dateFrom,
      date_to: builder.dateTo,
      benchmark: builder.benchmark,
      risk_settings: builder.riskSettings,
      parameters: builder.parameters,
    };

    const result = backtestRequestSchema.safeParse(payload);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.errors) {
        const key = issue.path.join(".");
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      toast.error("Please fix the validation errors below");
      return;
    }

    await startBacktest({
      name: builder.name || undefined,
      strategy_type: result.data.strategy_type,
      ticker: result.data.ticker,
      date_from: result.data.date_from,
      date_to: result.data.date_to,
      benchmark: result.data.benchmark,
      risk_settings: result.data.risk_settings as Record<string, unknown>,
      parameters: result.data.parameters,
    });
  }, [builder, startBacktest]);

  const handleReset = useCallback(() => {
    dispatch(resetBuilder());
    setFieldErrors({});
  }, [dispatch]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12" data-testid="strategy-builder-form">
      {/* Onboarding modal for first-time users */}
      <OnboardingModal open={onboardingOpen} onOpenChange={setOnboardingOpen} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            New Backtest
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure and run a trading strategy backtest.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={isRunning}
          data-testid="reset-builder-button"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      {/* Strategy Name (optional) */}
      <section className="space-y-2">
        <Label htmlFor="strategy-name">Strategy Name (optional)</Label>
        <Input
          id="strategy-name"
          placeholder="My Strategy"
          value={builder.name}
          onChange={(e) => dispatch(setName(e.target.value))}
          disabled={isRunning}
          data-testid="strategy-name-input"
        />
      </section>

      {/* Ticker Selection */}
      <section>
        <TickerSearch
          label="Ticker"
          value={builder.ticker}
          onChange={(t) => dispatch(setTicker(t))}
          disabled={isRunning}
        />
        {fieldErrors["ticker"] && (
          <p className="mt-1 text-sm text-destructive" data-testid="field-error-ticker">{fieldErrors["ticker"]}</p>
        )}
      </section>

      {/* Date Range */}
      <section className="space-y-2">
        <Label>Date Range</Label>
        <DateRangePicker
          dateFrom={builder.dateFrom}
          dateTo={builder.dateTo}
          onChange={(range) => dispatch(setDateRange(range))}
          disabled={isRunning}
        />
        {fieldErrors["date_from"] && (
          <p className="mt-1 text-sm text-destructive" data-testid="field-error-date-from">{fieldErrors["date_from"]}</p>
        )}
        {fieldErrors["date_to"] && (
          <p className="mt-1 text-sm text-destructive" data-testid="field-error-date-to">{fieldErrors["date_to"]}</p>
        )}
      </section>

      {/* Strategy Type */}
      <section>
        <StrategyTypeSelector
          value={builder.strategyType}
          onChange={(type: StrategyType) => dispatch(setStrategyType(type))}
          disabled={isRunning}
        />
      </section>

      {/* Strategy Parameters */}
      <section className="space-y-2">
        <Label>Strategy Parameters</Label>
        <StrategyParamsForm
          strategyType={builder.strategyType}
          parameters={builder.parameters}
          onParameterChange={(key, value) =>
            dispatch(setParameter({ key, value }))
          }
          disabled={isRunning}
        />
      </section>

      {/* Risk Settings */}
      <section className="space-y-2">
        <Label className="text-base font-semibold">Risk Settings</Label>
        <RiskSettingsForm
          value={builder.riskSettings}
          onChange={(partial) => dispatch(setRiskSettings(partial))}
          disabled={isRunning}
        />
        {Object.entries(fieldErrors)
          .filter(([key]) => key.startsWith("risk_settings."))
          .map(([key, msg]) => (
            <p key={key} className="text-sm text-destructive" data-testid={`field-error-${key}`}>{msg}</p>
          ))
        }
      </section>

      {/* Benchmark */}
      <section>
        <BenchmarkSelector
          value={builder.benchmark}
          onChange={(b) => dispatch(setBenchmark(b))}
          disabled={isRunning}
        />
        {fieldErrors["benchmark"] && (
          <p className="mt-1 text-sm text-destructive" data-testid="field-error-benchmark">{fieldErrors["benchmark"]}</p>
        )}
      </section>

      {/* Validation Error Summary */}
      {Object.keys(fieldErrors).length > 0 && (
        <div
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
          data-testid="validation-error"
        >
          Please fix {Object.keys(fieldErrors).length} validation{" "}
          {Object.keys(fieldErrors).length === 1 ? "error" : "errors"} above.
        </div>
      )}

      {/* Run Button */}
      <RunButton onRun={handleRun} disabled={isRunning} />
    </div>
  );
}

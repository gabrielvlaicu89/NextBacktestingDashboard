"use client";

/**
 * OnboardingModal — shown to first-time users (0 saved strategies).
 *
 * Presents pre-built strategy templates that pre-fill the Strategy Builder form,
 * giving new users a fast on-ramp instead of starting from scratch.
 */
import { useCallback } from "react";
import { Sparkles } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { prefillFromStrategy } from "@/store/slices/strategyBuilderSlice";
import { DEFAULT_RISK_SETTINGS } from "@/lib/types";
import type { StrategyType, RiskSettings } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Template definitions ────────────────────────────────────────────────────

export interface StrategyTemplate {
  title: string;
  description: string;
  ticker: string;
  dateFrom: string;
  dateTo: string;
  strategyType: StrategyType;
  parameters: Record<string, unknown>;
  riskSettings: RiskSettings;
  benchmark: string;
  name: string;
  tags: string[];
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    title: "SPY Mean Reversion (2020–2024)",
    description:
      "Classic Z-score mean reversion on the S&P 500 ETF over a volatile 5-year window.",
    ticker: "SPY",
    dateFrom: "2020-01-01",
    dateTo: "2024-12-31",
    strategyType: "MEAN_REVERSION",
    parameters: { zscore_window: 20, zscore_threshold: 2.0, holding_period: 10 },
    riskSettings: DEFAULT_RISK_SETTINGS,
    benchmark: "SPY",
    name: "SPY Mean Reversion",
    tags: ["mean-reversion", "spy"],
  },
  {
    title: "AAPL MA Crossover",
    description:
      "Golden/death cross strategy using 10/50-day EMA crossover on Apple stock.",
    ticker: "AAPL",
    dateFrom: "2020-01-01",
    dateTo: "2024-12-31",
    strategyType: "MA_CROSSOVER",
    parameters: { fast_period: 10, slow_period: 50, ma_type: "EMA" },
    riskSettings: DEFAULT_RISK_SETTINGS,
    benchmark: "SPY",
    name: "AAPL MA Crossover",
    tags: ["ma-crossover", "aapl"],
  },
  {
    title: "MSFT Earnings Drift",
    description:
      "Trade the post-earnings announcement drift on Microsoft around quarterly earnings.",
    ticker: "MSFT",
    dateFrom: "2021-01-01",
    dateTo: "2024-12-31",
    strategyType: "EARNINGS_DRIFT",
    parameters: { days_before: 2, days_after: 5, eps_surprise_threshold: 0 },
    riskSettings: DEFAULT_RISK_SETTINGS,
    benchmark: "SPY",
    name: "MSFT Earnings Drift",
    tags: ["earnings", "msft"],
  },
];

// ── Component ───────────────────────────────────────────────────────────────

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingModal({ open, onOpenChange }: OnboardingModalProps) {
  const dispatch = useAppDispatch();

  const handleSelectTemplate = useCallback(
    (template: StrategyTemplate) => {
      dispatch(
        prefillFromStrategy({
          ticker: template.ticker,
          dateFrom: template.dateFrom,
          dateTo: template.dateTo,
          strategyType: template.strategyType,
          parameters: template.parameters,
          riskSettings: template.riskSettings,
          benchmark: template.benchmark,
          name: template.name,
          tags: template.tags,
        })
      );
      onOpenChange(false);
    },
    [dispatch, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="onboarding-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Welcome! Pick a template to get started
          </DialogTitle>
          <DialogDescription>
            Choose a pre-built strategy to explore the platform, or close this
            dialog to start from scratch.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3" data-testid="template-list">
          {STRATEGY_TEMPLATES.map((template) => (
            <button
              key={template.title}
              type="button"
              onClick={() => handleSelectTemplate(template)}
              data-testid={`template-${template.strategyType}`}
              className="w-full rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <h4 className="text-sm font-semibold">{template.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {template.description}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

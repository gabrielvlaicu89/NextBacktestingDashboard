/**
 * Tests for OptimizeConfigForm component.
 *
 * Verifies rendering of numeric param range inputs, fixed-param display,
 * metric selector, form submission shape, and disabled state.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OptimizeConfigForm } from "@/components/optimization/optimize-config-form";
import type { StrategyWithRuns, StrategyCatalogItem, OptimizeConfig } from "@/lib/types";

// ── Mock next/navigation (not used but referenced inside Link) ─────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ── Test data ──────────────────────────────────────────────────────────────────

/** Catalog with 2 numeric + 1 select param (mirrors MA_CROSSOVER) */
const mixedCatalog: StrategyCatalogItem = {
  type: "MA_CROSSOVER",
  label: "Moving Average Crossover",
  description: "Buys on golden cross.",
  params: [
    { key: "fast_period", label: "Fast MA Period", type: "number", default: 10, min: 2, step: 1 },
    { key: "slow_period", label: "Slow MA Period", type: "number", default: 50, min: 5, step: 5 },
    { key: "ma_type", label: "MA Type", type: "select", options: ["SMA", "EMA"], default: "EMA" },
  ],
};

/** Catalog with only numeric params */
const numericOnlyCatalog: StrategyCatalogItem = {
  type: "MEAN_REVERSION",
  label: "Mean Reversion",
  description: "Z-score based.",
  params: [
    { key: "zscore_window", label: "Z-Score Window", type: "number", default: 20, min: 5, step: 1 },
    { key: "zscore_threshold", label: "Z-Score Threshold", type: "number", default: 2.0, min: 0.5, step: 0.25 },
  ],
};

/** Catalog with no numeric params */
const noNumericCatalog: StrategyCatalogItem = {
  type: "BUY_AND_HOLD",
  label: "Buy & Hold",
  description: "Just buys.",
  params: [
    { key: "ticker", label: "Ticker", type: "ticker", default: "SPY" },
  ],
};

function makeStrategy(type: string, parameters: Record<string, unknown> = {}): StrategyWithRuns {
  return {
    id: "strat-1",
    userId: "user-1",
    name: "Test Strategy",
    type: type as StrategyWithRuns["type"],
    ticker: "SPY",
    benchmark: "SPY",
    dateFrom: "2020-01-01T00:00:00.000Z",
    dateTo: "2024-01-01T00:00:00.000Z",
    parameters,
    riskSettings: {
      starting_capital: 10000,
      position_sizing_mode: "PERCENT_PORTFOLIO",
      position_size: 100,
      stop_loss_pct: null,
      take_profit_pct: null,
    },
    tags: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    runs: [],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("OptimizeConfigForm", () => {
  let onSubmit: Mock<(config: OptimizeConfig) => void>;

  beforeEach(() => {
    onSubmit = vi.fn<(config: OptimizeConfig) => void>();
  });

  // Rendering
  it("renders the form container", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("MA_CROSSOVER", { fast_period: 10, slow_period: 50, ma_type: "EMA" })}
        catalog={mixedCatalog}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByTestId("optimize-config-form")).toBeInTheDocument();
  });

  it("renders a param-range section for each numeric param", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("MA_CROSSOVER", { fast_period: 10, slow_period: 50, ma_type: "EMA" })}
        catalog={mixedCatalog}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByTestId("param-range-fast_period")).toBeInTheDocument();
    expect(screen.getByTestId("param-range-slow_period")).toBeInTheDocument();
  });

  it("shows min / max / step inputs for each numeric param", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("MA_CROSSOVER", { fast_period: 10, slow_period: 50, ma_type: "EMA" })}
        catalog={mixedCatalog}
        onSubmit={onSubmit}
      />
    );
    // fast_period should have min/max/step inputs
    expect(screen.getByLabelText("Min", { selector: "#fast_period-min" })).toBeInTheDocument();
    expect(screen.getByLabelText("Max", { selector: "#fast_period-max" })).toBeInTheDocument();
    expect(screen.getByLabelText("Step", { selector: "#fast_period-step" })).toBeInTheDocument();
  });

  it("shows fixed-params section for non-numeric params", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("MA_CROSSOVER", { fast_period: 10, slow_period: 50, ma_type: "EMA" })}
        catalog={mixedCatalog}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByText(/Fixed Parameters/i)).toBeInTheDocument();
    expect(screen.getByText("MA Type")).toBeInTheDocument();
    expect(screen.getByText("EMA")).toBeInTheDocument();
  });

  it("does not render fixed-params section when all params are numeric", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("MEAN_REVERSION", { zscore_window: 20, zscore_threshold: 2.0 })}
        catalog={numericOnlyCatalog}
        onSubmit={onSubmit}
      />
    );
    expect(screen.queryByText(/Fixed Parameters/i)).not.toBeInTheDocument();
  });

  it("renders the optimize-for select", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("MA_CROSSOVER")}
        catalog={mixedCatalog}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByLabelText(/Optimize for metric/i)).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("MA_CROSSOVER")}
        catalog={mixedCatalog}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByRole("button", { name: /Run Optimization/i })).toBeInTheDocument();
  });

  // Disabled state
  it("disables the submit button when disabled=true", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("MA_CROSSOVER")}
        catalog={mixedCatalog}
        onSubmit={onSubmit}
        disabled
      />
    );
    expect(screen.getByRole("button", { name: /Optimizing/i })).toBeDisabled();
  });

  it("disables inputs when disabled=true", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("MA_CROSSOVER", { fast_period: 10, slow_period: 50, ma_type: "EMA" })}
        catalog={mixedCatalog}
        onSubmit={onSubmit}
        disabled
      />
    );
    const minInput = screen.getByLabelText("Min", { selector: "#fast_period-min" });
    expect(minInput).toBeDisabled();
  });

  // No-numeric edge case
  it("shows empty-state message when strategy has no numeric params", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("BUY_AND_HOLD", { ticker: "SPY" })}
        catalog={noNumericCatalog}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByText(/no numeric parameters/i)).toBeInTheDocument();
  });

  it("disables the submit button when no numeric params exist", () => {
    render(
      <OptimizeConfigForm
        strategy={makeStrategy("BUY_AND_HOLD", { ticker: "SPY" })}
        catalog={noNumericCatalog}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByRole("button", { name: /Run Optimization/i })).toBeDisabled();
  });

  // Submission — use fireEvent.submit because Radix Select intercepts pointer events
  it("calls onSubmit with an OptimizeConfig when form is submitted", () => {
    const { getByTestId } = render(
      <OptimizeConfigForm
        strategy={makeStrategy("MA_CROSSOVER", { fast_period: 10, slow_period: 50, ma_type: "EMA" })}
        catalog={mixedCatalog}
        onSubmit={onSubmit}
      />
    );
    fireEvent.submit(getByTestId("optimize-config-form"));
    expect(onSubmit).toHaveBeenCalledOnce();

    const config: OptimizeConfig = onSubmit.mock.calls[0][0];
    expect(config.strategy_type).toBe("MA_CROSSOVER");
    expect(config.ticker).toBe("SPY");
    expect(config.param_ranges).toHaveProperty("fast_period");
    expect(config.param_ranges).toHaveProperty("slow_period");
    expect(config.fixed_parameters).toHaveProperty("ma_type", "EMA");
    expect(config.optimize_for).toBe("sharpe_ratio");
  });

  it("includes min/max/step in the submitted param_ranges", () => {
    const { getByTestId } = render(
      <OptimizeConfigForm
        strategy={makeStrategy("MEAN_REVERSION", { zscore_window: 20, zscore_threshold: 2.0 })}
        catalog={numericOnlyCatalog}
        onSubmit={onSubmit}
      />
    );
    fireEvent.submit(getByTestId("optimize-config-form"));
    const config: OptimizeConfig = onSubmit.mock.calls[0][0];
    expect(config.param_ranges["zscore_window"]).toMatchObject({
      min: expect.any(Number),
      max: expect.any(Number),
      step: expect.any(Number),
    });
  });
});

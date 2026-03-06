import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StrategyParamsForm } from "@/components/strategy-builder/strategy-params-form";

// ---------------------------------------------------------------------------
// Mocks for the TickerSearch used inside (for "ticker" type params)
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useTickerSearch", () => ({
  useTickerSearch: () => ({
    query: "",
    setQuery: vi.fn(),
    results: [],
    loading: false,
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StrategyParamsForm", () => {
  const onParameterChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Select a strategy' message when no strategyType", () => {
    render(
      <StrategyParamsForm
        strategyType={null}
        parameters={{}}
        onParameterChange={onParameterChange}
      />
    );
    expect(screen.getByTestId("no-strategy-msg")).toHaveTextContent(
      "Select a strategy type"
    );
  });

  it("shows 'no configurable parameters' for BUY_AND_HOLD", () => {
    render(
      <StrategyParamsForm
        strategyType="BUY_AND_HOLD"
        parameters={{}}
        onParameterChange={onParameterChange}
      />
    );
    expect(screen.getByTestId("no-params-msg")).toHaveTextContent(
      "no configurable parameters"
    );
  });

  it("renders number inputs for MEAN_REVERSION params", () => {
    render(
      <StrategyParamsForm
        strategyType="MEAN_REVERSION"
        parameters={{}}
        onParameterChange={onParameterChange}
      />
    );
    expect(screen.getByTestId("param-zscore_window")).toBeInTheDocument();
    expect(screen.getByTestId("param-zscore_threshold")).toBeInTheDocument();
    expect(screen.getByTestId("param-holding_period")).toBeInTheDocument();
  });

  it("renders number inputs for MA_CROSSOVER params", () => {
    render(
      <StrategyParamsForm
        strategyType="MA_CROSSOVER"
        parameters={{}}
        onParameterChange={onParameterChange}
      />
    );
    expect(screen.getByTestId("param-fast_period")).toBeInTheDocument();
    expect(screen.getByTestId("param-slow_period")).toBeInTheDocument();
    expect(screen.getByTestId("param-ma_type")).toBeInTheDocument();
  });

  it("renders default values for MEAN_REVERSION when parameters empty", () => {
    render(
      <StrategyParamsForm
        strategyType="MEAN_REVERSION"
        parameters={{}}
        onParameterChange={onParameterChange}
      />
    );
    const zscoreWindow = screen.getByTestId("param-zscore_window");
    expect(zscoreWindow).toHaveValue(20);
  });

  it("renders overridden values from parameters prop", () => {
    render(
      <StrategyParamsForm
        strategyType="MEAN_REVERSION"
        parameters={{ zscore_window: 30 }}
        onParameterChange={onParameterChange}
      />
    );
    expect(screen.getByTestId("param-zscore_window")).toHaveValue(30);
  });

  it("renders labels for each parameter", () => {
    render(
      <StrategyParamsForm
        strategyType="MEAN_REVERSION"
        parameters={{}}
        onParameterChange={onParameterChange}
      />
    );
    expect(screen.getByText("Z-Score Window")).toBeInTheDocument();
    expect(screen.getByText("Z-Score Threshold")).toBeInTheDocument();
    expect(screen.getByText("Max Holding Period (days)")).toBeInTheDocument();
  });

  it("renders params for EARNINGS_DRIFT", () => {
    render(
      <StrategyParamsForm
        strategyType="EARNINGS_DRIFT"
        parameters={{}}
        onParameterChange={onParameterChange}
      />
    );
    expect(screen.getByTestId("param-days_before")).toBeInTheDocument();
    expect(screen.getByTestId("param-days_after")).toBeInTheDocument();
    expect(
      screen.getByTestId("param-eps_surprise_threshold")
    ).toBeInTheDocument();
  });

  it("renders ticker field for PAIRS_TRADING ticker_b param", () => {
    render(
      <StrategyParamsForm
        strategyType="PAIRS_TRADING"
        parameters={{}}
        onParameterChange={onParameterChange}
      />
    );
    // ticker_b param renders a TickerSearch with label "Second Ticker"
    expect(screen.getByText("Second Ticker")).toBeInTheDocument();
  });

  it("renders data-testid strategy-params-form wrapper when params exist", () => {
    render(
      <StrategyParamsForm
        strategyType="MEAN_REVERSION"
        parameters={{}}
        onParameterChange={onParameterChange}
      />
    );
    expect(screen.getByTestId("strategy-params-form")).toBeInTheDocument();
  });

  it("disables inputs when disabled=true", () => {
    render(
      <StrategyParamsForm
        strategyType="MEAN_REVERSION"
        parameters={{}}
        onParameterChange={onParameterChange}
        disabled
      />
    );
    expect(screen.getByTestId("param-zscore_window")).toBeDisabled();
    expect(screen.getByTestId("param-zscore_threshold")).toBeDisabled();
    expect(screen.getByTestId("param-holding_period")).toBeDisabled();
  });
});

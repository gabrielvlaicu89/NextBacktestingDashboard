import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { StrategyBuilderForm } from "@/components/strategy-builder/strategy-builder-form";
import { renderWithStore } from "@/__tests__/helpers/render-with-store";

const CUSTOM_DRAFT = {
  version: 1 as const,
  name: "RSI Draft",
  description: "Uses RSI for long entries.",
  indicators: [],
  longEntry: {
    type: "group" as const,
    operator: "AND" as const,
    conditions: [
      {
        type: "condition" as const,
        left: { kind: "price" as const, field: "CLOSE" as const },
        comparator: ">" as const,
        right: { kind: "constant" as const, value: 100 },
      },
    ],
  },
  longExit: {
    type: "group" as const,
    operator: "AND" as const,
    conditions: [
      {
        type: "condition" as const,
        left: { kind: "price" as const, field: "CLOSE" as const },
        comparator: "<" as const,
        right: { kind: "constant" as const, value: 99 },
      },
    ],
  },
  shortEntry: { type: "group" as const, operator: "AND" as const, conditions: [] },
  shortExit: { type: "group" as const, operator: "AND" as const, conditions: [] },
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useTickerSearch", () => ({
  useTickerSearch: () => ({
    query: "",
    setQuery: vi.fn(),
    results: [],
    loading: false,
  }),
}));

vi.mock("@/hooks/useBacktestStream", () => ({
  useBacktestStream: () => ({
    startBacktest: vi.fn(),
    abort: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StrategyBuilderForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form wrapper", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByTestId("strategy-builder-form")).toBeInTheDocument();
  });

  it("renders the 'New Backtest' heading", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(
      screen.getByRole("heading", { name: /New Backtest/i })
    ).toBeInTheDocument();
  });

  it("renders a reset button", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByTestId("reset-builder-button")).toBeInTheDocument();
  });

  it("renders strategy name input", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByTestId("strategy-name-input")).toBeInTheDocument();
  });

  it("renders Ticker label", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByText("Ticker")).toBeInTheDocument();
  });

  it("renders Date Range label", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByText("Date Range")).toBeInTheDocument();
  });

  it("renders Strategy Type label", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByText("Strategy Type")).toBeInTheDocument();
  });

  it("renders Strategy Parameters label", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByText("Strategy Parameters")).toBeInTheDocument();
  });

  it("renders Risk Settings label", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByText("Risk Settings")).toBeInTheDocument();
  });

  it("renders Benchmark Ticker label", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByText("Benchmark Ticker")).toBeInTheDocument();
  });

  it("renders Run Backtest button", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByTestId("run-backtest-button")).toBeInTheDocument();
  });

  it("renders 'Select a strategy' message when no strategy selected", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.getByTestId("no-strategy-msg")).toHaveTextContent(
      "Select a strategy type"
    );
  });

  it("renders 5 strategy cards", () => {
    renderWithStore(<StrategyBuilderForm />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
  });

  it("does not show validation error initially", () => {
    renderWithStore(<StrategyBuilderForm />);
    expect(screen.queryByTestId("validation-error")).not.toBeInTheDocument();
  });

  it("shows a custom runtime summary and hides built-in strategy controls in custom mode", () => {
    renderWithStore(<StrategyBuilderForm />, {
      preloadedState: {
        strategyBuilder: {
          name: "RSI Draft",
          ticker: "SPY",
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
          builderMode: "CUSTOM",
          strategyType: null,
          parameters: {},
          customStrategy: CUSTOM_DRAFT,
          riskSettings: {
            starting_capital: 10000,
            position_sizing_mode: "PERCENT_PORTFOLIO",
            position_size: 100,
            stop_loss_pct: null,
            take_profit_pct: null,
          },
          benchmark: "SPY",
          tags: ["daily"],
        },
      },
    });

    expect(screen.getByTestId("custom-strategy-runtime-summary")).toBeInTheDocument();
    expect(screen.getByTestId("selected-custom-strategy-name")).toHaveTextContent(
      "RSI Draft",
    );
    expect(screen.queryByText("Strategy Type")).not.toBeInTheDocument();
    expect(screen.queryByText("Strategy Parameters")).not.toBeInTheDocument();
    expect(screen.getByTestId("run-backtest-button")).not.toBeDisabled();
  });
});

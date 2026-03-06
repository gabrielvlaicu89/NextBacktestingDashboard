import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { StrategyBuilderForm } from "@/components/strategy-builder/strategy-builder-form";
import { renderWithStore } from "@/__tests__/helpers/render-with-store";

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
});

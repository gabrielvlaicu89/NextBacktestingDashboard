/**
 * Tests for ResultsDashboard orchestrator component.
 *
 * Uses renderWithStore helper to inject preloaded Redux state.
 * Mocks chart components to avoid DOM measurement issues.
 */
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithStore } from "@/__tests__/helpers/render-with-store";
import { ResultsDashboard } from "@/components/results/results-dashboard";
import type { BacktestResponse, StrategyWithRuns } from "@/lib/types";
import type { BacktestState } from "@/store/slices/backtestSlice";

// Mock chart components to avoid lightweight-charts / recharts DOM issues
vi.mock("@/components/results/equity-curve-chart", () => ({
  EquityCurveChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="equity-curve-chart">Equity ({data.length} pts)</div>
  ),
}));
vi.mock("@/components/results/drawdown-chart", () => ({
  DrawdownChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="drawdown-chart">Drawdown ({data.length} pts)</div>
  ),
}));
vi.mock("@/components/results/monthly-returns-heatmap", () => ({
  MonthlyReturnsHeatmap: ({ data }: { data: unknown[] }) => (
    <div data-testid="monthly-heatmap">Monthly ({data.length} entries)</div>
  ),
}));
vi.mock("@/components/results/trade-distribution-chart", () => ({
  TradeDistributionChart: ({ trades }: { trades: unknown[] }) => (
    <div data-testid="trade-distribution">Distribution ({trades.length} trades)</div>
  ),
}));
vi.mock("@/components/results/trade-log-table", () => ({
  TradeLogTable: ({ trades }: { trades: unknown[] }) => (
    <div data-testid="trade-log-table">Trades ({trades.length})</div>
  ),
}));
vi.mock("@/components/results/save-experiment-dialog", () => ({
  SaveExperimentDialog: () => (
    <button data-testid="save-experiment-trigger">Save</button>
  ),
}));

// Mock server action used by SaveExperimentDialog
vi.mock("@/lib/actions/strategies", () => ({
  updateStrategy: vi.fn(),
}));

const sampleMetrics = {
  total_return_pct: 25.5,
  annualized_return_pct: 18.2,
  max_drawdown_pct: -12.3,
  sharpe_ratio: 1.65,
  sortino_ratio: 2.1,
  win_rate_pct: 62.5,
  profit_factor: 1.8,
};

const sampleResults: BacktestResponse = {
  metrics: sampleMetrics,
  equity_curve: [
    { date: "2023-01-01", value: 10000, benchmark_value: 10000 },
    { date: "2023-01-02", value: 10200, benchmark_value: 10100 },
  ],
  drawdown_series: [
    { date: "2023-01-01", drawdown_pct: 0 },
    { date: "2023-01-02", drawdown_pct: -2.5 },
  ],
  monthly_returns: [
    { year: 2023, month: 1, return_pct: 3.5 },
  ],
  trades: [
    {
      entry_date: "2023-01-10",
      exit_date: "2023-01-20",
      entry_price: 100,
      exit_price: 108,
      pnl: 800,
      pnl_pct: 8.0,
      holding_days: 10,
      exit_reason: "signal",
    },
  ],
};

const sampleStrategy: StrategyWithRuns = {
  id: "strat-1",
  userId: "user-1",
  name: "Test Strategy",
  type: "MA_CROSSOVER",
  ticker: "AAPL",
  benchmark: "SPY",
  dateFrom: "2023-01-01T00:00:00.000Z",
  dateTo: "2023-12-31T00:00:00.000Z",
  parameters: { fast_period: 10, slow_period: 50 },
  riskSettings: {
    starting_capital: 10000,
    position_sizing_mode: "PERCENT_PORTFOLIO",
    position_size: 100,
    stop_loss_pct: null,
    take_profit_pct: null,
  },
  tags: ["test", "daily"],
  createdAt: "2023-01-01T00:00:00.000Z",
  updatedAt: "2023-01-01T00:00:00.000Z",
  runs: [],
};

function makeBacktestState(overrides: Partial<BacktestState> = {}): { backtest: BacktestState } {
  return {
    backtest: {
      runId: null,
      strategyId: null,
      status: "idle",
      progress: 0,
      message: "",
      results: null,
      error: null,
      ...overrides,
    },
  };
}

describe("ResultsDashboard", () => {
  it("shows progress bar when backtest is running", () => {
    renderWithStore(<ResultsDashboard />, {
      preloadedState: makeBacktestState({
        status: "running",
        progress: 42,
        message: "Processing trades…",
      }),
    });
    expect(screen.getByTestId("backtest-progress")).toBeInTheDocument();
  });

  it("shows error state when backtest failed", () => {
    renderWithStore(<ResultsDashboard />, {
      preloadedState: makeBacktestState({
        status: "failed",
        error: "Timeout reached",
      }),
    });
    expect(screen.getByTestId("backtest-error")).toBeInTheDocument();
    expect(screen.getByText("Timeout reached")).toBeInTheDocument();
  });

  it("shows no-results placeholder when idle with no data", () => {
    renderWithStore(<ResultsDashboard />, {
      preloadedState: makeBacktestState({ status: "idle" }),
    });
    expect(screen.getByTestId("no-results")).toBeInTheDocument();
    expect(screen.getByText(/run a backtest/i)).toBeInTheDocument();
  });

  it("renders full dashboard with Redux results", () => {
    renderWithStore(<ResultsDashboard strategyId="strat-1" />, {
      preloadedState: makeBacktestState({
        status: "completed",
        results: sampleResults,
        strategyId: "strat-1",
      }),
    });
    expect(screen.getByTestId("results-dashboard")).toBeInTheDocument();
  });

  it("renders full dashboard with savedResults (server-loaded)", () => {
    renderWithStore(
      <ResultsDashboard
        strategy={sampleStrategy}
        savedResults={sampleResults}
        strategyId="strat-1"
      />,
      { preloadedState: makeBacktestState({ status: "idle" }) }
    );
    expect(screen.getByTestId("results-dashboard")).toBeInTheDocument();
  });

  it("displays strategy name from server data", () => {
    renderWithStore(
      <ResultsDashboard
        strategy={sampleStrategy}
        savedResults={sampleResults}
        strategyId="strat-1"
      />,
      { preloadedState: makeBacktestState() }
    );
    expect(screen.getByText("Test Strategy")).toBeInTheDocument();
  });

  it("displays fallback title when no strategy provided", () => {
    renderWithStore(<ResultsDashboard strategyId="strat-1" />, {
      preloadedState: makeBacktestState({
        status: "completed",
        results: sampleResults,
      }),
    });
    expect(screen.getByText("Backtest Results")).toBeInTheDocument();
  });

  it("displays strategy metadata line", () => {
    renderWithStore(
      <ResultsDashboard
        strategy={sampleStrategy}
        savedResults={sampleResults}
      />,
      { preloadedState: makeBacktestState() }
    );
    expect(screen.getByText(/AAPL/)).toBeInTheDocument();
  });

  it("renders performance cards section", () => {
    renderWithStore(
      <ResultsDashboard savedResults={sampleResults} />,
      { preloadedState: makeBacktestState() }
    );
    // Performance cards are rendered by the actual component (not mocked)
    expect(screen.getByTestId("performance-cards")).toBeInTheDocument();
  });

  it("renders tab triggers for all chart views", () => {
    renderWithStore(
      <ResultsDashboard savedResults={sampleResults} />,
      { preloadedState: makeBacktestState() }
    );
    expect(screen.getByText("Equity Curve")).toBeInTheDocument();
    expect(screen.getByText("Drawdown")).toBeInTheDocument();
    expect(screen.getByText("Monthly Returns")).toBeInTheDocument();
    expect(screen.getByText("Distribution")).toBeInTheDocument();
  });

  it("renders the equity curve chart (default tab)", () => {
    renderWithStore(
      <ResultsDashboard savedResults={sampleResults} />,
      { preloadedState: makeBacktestState() }
    );
    expect(screen.getByTestId("equity-curve-chart")).toBeInTheDocument();
  });

  it("renders the trade log table", () => {
    renderWithStore(
      <ResultsDashboard savedResults={sampleResults} />,
      { preloadedState: makeBacktestState() }
    );
    expect(screen.getByTestId("trade-log-table")).toBeInTheDocument();
  });

  it("renders save experiment button when strategyId is provided", () => {
    renderWithStore(
      <ResultsDashboard savedResults={sampleResults} strategyId="strat-1" />,
      { preloadedState: makeBacktestState() }
    );
    expect(screen.getByTestId("save-experiment-trigger")).toBeInTheDocument();
  });

  it("prefers savedResults over Redux results", () => {
    // Redux has different results, server has sampleResults
    const altResults = { ...sampleResults, trades: [] };
    renderWithStore(
      <ResultsDashboard savedResults={sampleResults} />,
      {
        preloadedState: makeBacktestState({
          status: "completed",
          results: altResults,
        }),
      }
    );
    // sampleResults has 1 trade; altResults has 0.
    // trade-log-table mock shows the count from savedResults
    expect(screen.getByText("Trades (1)")).toBeInTheDocument();
  });
});

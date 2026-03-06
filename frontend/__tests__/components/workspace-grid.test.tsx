/**
 * Tests for WorkspaceGrid component.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within, act } from "@testing-library/react";
import { WorkspaceGrid } from "@/components/workspace/workspace-grid";
import { renderWithStore } from "../helpers/render-with-store";
import {
  setSortBy,
  setSortDirection,
  setFilterType,
} from "@/store/slices/workspaceSlice";
import type { StrategyWithRuns, BacktestResponse } from "@/lib/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/actions/strategies", () => ({
  deleteStrategy: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Test Data ─────────────────────────────────────────────────────────────────

function makeStrategy(
  overrides: Partial<StrategyWithRuns> & { id: string },
  metricOverrides: Partial<BacktestResponse["metrics"]> = {},
): StrategyWithRuns {
  const metrics: BacktestResponse["metrics"] = {
    total_return_pct: 10,
    annualized_return_pct: 5,
    max_drawdown_pct: -5,
    sharpe_ratio: 1.0,
    sortino_ratio: 1.5,
    win_rate_pct: 50,
    profit_factor: 1.2,
    ...metricOverrides,
  };

  const base: StrategyWithRuns = {
    userId: "user-1",
    name: `Strategy ${overrides.id}`,
    type: "MEAN_REVERSION",
    ticker: "SPY",
    benchmark: "SPY",
    dateFrom: "2020-01-01T00:00:00.000Z",
    dateTo: "2024-01-01T00:00:00.000Z",
    parameters: {},
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
    ...overrides,
    // Always build runs from the merged metrics (ensure metric overrides apply)
    runs: [
      {
        id: `run-${overrides.id}`,
        strategyId: overrides.id,
        userId: "user-1",
        status: "COMPLETED",
        results: {
          metrics,
          equity_curve: [],
          drawdown_series: [],
          monthly_returns: [],
          trades: [],
        },
        errorMsg: null,
        duration: 500,
        createdAt: overrides.createdAt ?? "2024-01-01T00:00:00.000Z",
      },
    ],
    id: overrides.id,
  };

  return base;
}

const stratA = makeStrategy(
  {
    id: "a",
    name: "Alpha Strategy",
    type: "MA_CROSSOVER",
    tags: ["momentum"],
    createdAt: "2024-01-10T00:00:00.000Z",
  },
  { total_return_pct: 30, sharpe_ratio: 2.0 },
);

const stratB = makeStrategy(
  {
    id: "b",
    name: "Beta Strategy",
    type: "MEAN_REVERSION",
    tags: ["value"],
    createdAt: "2024-02-05T00:00:00.000Z",
  },
  { total_return_pct: 10, sharpe_ratio: 0.8 },
);

const stratC = makeStrategy(
  {
    id: "c",
    name: "Gamma Strategy",
    type: "BUY_AND_HOLD",
    tags: ["benchmark"],
    createdAt: "2024-03-01T00:00:00.000Z",
  },
  { total_return_pct: 50, sharpe_ratio: 1.5 },
);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WorkspaceGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders strategy cards from initialStrategies", () => {
    renderWithStore(
      <WorkspaceGrid initialStrategies={[stratA, stratB, stratC]} />,
    );
    expect(screen.getByText("Alpha Strategy")).toBeInTheDocument();
    expect(screen.getByText("Beta Strategy")).toBeInTheDocument();
    expect(screen.getByText("Gamma Strategy")).toBeInTheDocument();
  });

  it("hydrates the Redux workspace slice with initial strategies", () => {
    const { store } = renderWithStore(
      <WorkspaceGrid initialStrategies={[stratA, stratB]} />,
    );
    expect(store.getState().workspace.strategies).toHaveLength(2);
  });

  it("displays empty state when no strategies", () => {
    renderWithStore(<WorkspaceGrid initialStrategies={[]} />);
    expect(screen.getByText("No strategies found")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first backtest to get started."),
    ).toBeInTheDocument();
    expect(screen.getByText("New Backtest →")).toBeInTheDocument();
  });

  it("sorts by date descending by default (newest first)", () => {
    renderWithStore(
      <WorkspaceGrid initialStrategies={[stratA, stratB, stratC]} />,
    );

    const grid = screen.getByTestId("strategy-grid");
    const cards = within(grid).getAllByTestId("strategy-card");
    // stratC is newest (March), then stratB (Feb), then stratA (Jan)
    expect(cards[0]).toHaveTextContent("Gamma Strategy");
    expect(cards[1]).toHaveTextContent("Beta Strategy");
    expect(cards[2]).toHaveTextContent("Alpha Strategy");
  });

  it("sorts by Sharpe descending when sortBy is changed via Redux", () => {
    const { store } = renderWithStore(
      <WorkspaceGrid initialStrategies={[stratA, stratB, stratC]} />,
    );

    act(() => {
      store.dispatch(setSortBy("sharpe"));
    });

    const grid = screen.getByTestId("strategy-grid");
    const cards = within(grid).getAllByTestId("strategy-card");
    // Sharpe desc: stratA (2.0) > stratC (1.5) > stratB (0.8)
    expect(cards[0]).toHaveTextContent("Alpha Strategy");
    expect(cards[1]).toHaveTextContent("Gamma Strategy");
    expect(cards[2]).toHaveTextContent("Beta Strategy");
  });

  it("sorts ascending when direction is changed via Redux", () => {
    const { store } = renderWithStore(
      <WorkspaceGrid initialStrategies={[stratA, stratB, stratC]} />,
    );

    act(() => {
      store.dispatch(setSortDirection("asc"));
    });

    const grid = screen.getByTestId("strategy-grid");
    const cards = within(grid).getAllByTestId("strategy-card");
    // Date ascending: stratA (Jan) < stratB (Feb) < stratC (March)
    expect(cards[0]).toHaveTextContent("Alpha Strategy");
    expect(cards[1]).toHaveTextContent("Beta Strategy");
    expect(cards[2]).toHaveTextContent("Gamma Strategy");
  });

  it("filters by strategy type via Redux", () => {
    const { store } = renderWithStore(
      <WorkspaceGrid initialStrategies={[stratA, stratB, stratC]} />,
    );

    act(() => {
      store.dispatch(setFilterType("MA_CROSSOVER"));
    });

    const grid = screen.getByTestId("strategy-grid");
    const cards = within(grid).getAllByTestId("strategy-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("Alpha Strategy");
  });

  it("shows filtered empty state when filter matches nothing", () => {
    const { store } = renderWithStore(
      <WorkspaceGrid initialStrategies={[stratA, stratB]} />,
    );

    act(() => {
      store.dispatch(setFilterType("PAIRS_TRADING"));
    });

    expect(screen.getByText("No strategies found")).toBeInTheDocument();
    expect(
      screen.getByText("No strategies match the current filters."),
    ).toBeInTheDocument();
  });

  it("sorts by Total Return descending via Redux", () => {
    const { store } = renderWithStore(
      <WorkspaceGrid initialStrategies={[stratA, stratB, stratC]} />,
    );

    act(() => {
      store.dispatch(setSortBy("return"));
    });

    const grid = screen.getByTestId("strategy-grid");
    const cards = within(grid).getAllByTestId("strategy-card");
    // Return desc: stratC (50) > stratA (30) > stratB (10)
    expect(cards[0]).toHaveTextContent("Gamma Strategy");
    expect(cards[1]).toHaveTextContent("Alpha Strategy");
    expect(cards[2]).toHaveTextContent("Beta Strategy");
  });

  it("renders the toolbar", () => {
    renderWithStore(<WorkspaceGrid initialStrategies={[stratA]} />);
    expect(screen.getByTestId("workspace-toolbar")).toBeInTheDocument();
  });

  it("clears filter to show all strategies again", () => {
    const { store } = renderWithStore(
      <WorkspaceGrid initialStrategies={[stratA, stratB, stratC]} />,
    );

    // Filter then clear
    act(() => {
      store.dispatch(setFilterType("BUY_AND_HOLD"));
    });
    expect(within(screen.getByTestId("strategy-grid")).getAllByTestId("strategy-card")).toHaveLength(1);

    act(() => {
      store.dispatch(setFilterType(null));
    });
    expect(within(screen.getByTestId("strategy-grid")).getAllByTestId("strategy-card")).toHaveLength(3);
  });
});

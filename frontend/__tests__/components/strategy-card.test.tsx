/**
 * Tests for StrategyCard component.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrategyCard } from "@/components/workspace/strategy-card";
import { renderWithStore } from "../helpers/render-with-store";
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

import { deleteStrategy } from "@/lib/actions/strategies";
import { toast } from "sonner";
const mockDeleteStrategy = vi.mocked(deleteStrategy);
const mockToast = vi.mocked(toast);

// ── Test Data ─────────────────────────────────────────────────────────────────

const fakeMetrics: BacktestResponse["metrics"] = {
  total_return_pct: 25.5,
  annualized_return_pct: 12.0,
  max_drawdown_pct: -8.3,
  sharpe_ratio: 1.45,
  sortino_ratio: 2.1,
  win_rate_pct: 62.5,
  profit_factor: 1.8,
};

const fakeStrategy: StrategyWithRuns = {
  id: "strat-1",
  userId: "user-1",
  name: "SPY Mean Reversion",
  type: "MEAN_REVERSION",
  ticker: "SPY",
  benchmark: "SPY",
  dateFrom: "2020-01-01T00:00:00.000Z",
  dateTo: "2024-01-01T00:00:00.000Z",
  parameters: { window: 20, z_threshold: 2 },
  riskSettings: {
    starting_capital: 10000,
    position_sizing_mode: "PERCENT_PORTFOLIO",
    position_size: 100,
    stop_loss_pct: null,
    take_profit_pct: null,
  },
  tags: ["momentum", "daily"],
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T10:00:00.000Z",
  runs: [
    {
      id: "run-1",
      strategyId: "strat-1",
      userId: "user-1",
      status: "COMPLETED",
      results: {
        metrics: fakeMetrics,
        equity_curve: [],
        drawdown_series: [],
        monthly_returns: [],
        trades: [],
      },
      errorMsg: null,
      duration: 1200,
      createdAt: "2024-01-15T10:00:00.000Z",
    },
  ],
};

const strategyNoRuns: StrategyWithRuns = {
  ...fakeStrategy,
  id: "strat-2",
  name: "No Runs Strategy",
  runs: [],
  tags: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StrategyCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteStrategy.mockResolvedValue(undefined);
  });

  it("renders the strategy name and type", () => {
    renderWithStore(<StrategyCard strategy={fakeStrategy} />);
    expect(screen.getByText("SPY Mean Reversion")).toBeInTheDocument();
    expect(
      screen.getByText(/Mean Reversion · SPY/),
    ).toBeInTheDocument();
  });

  it("renders the date range", () => {
    renderWithStore(<StrategyCard strategy={fakeStrategy} />);
    expect(screen.getByText(/Jan 1, 2020/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
  });

  it("renders key metrics when a completed run exists", () => {
    renderWithStore(<StrategyCard strategy={fakeStrategy} />);
    expect(screen.getByText("+25.50%")).toBeInTheDocument();
    expect(screen.getByText("1.45")).toBeInTheDocument();
    expect(screen.getByText("-8.30%")).toBeInTheDocument();
    expect(screen.getByText("62.5%")).toBeInTheDocument();
  });

  it('shows "No completed runs" when there are no runs', () => {
    renderWithStore(<StrategyCard strategy={strategyNoRuns} />);
    expect(screen.getByText("No completed runs")).toBeInTheDocument();
  });

  it("renders tags as badges", () => {
    renderWithStore(<StrategyCard strategy={fakeStrategy} />);
    expect(screen.getByText("momentum")).toBeInTheDocument();
    expect(screen.getByText("daily")).toBeInTheDocument();
  });

  it("does not render tag badges when tags are empty", () => {
    renderWithStore(<StrategyCard strategy={strategyNoRuns} />);
    const card = screen.getByTestId("strategy-card");
    expect(within(card).queryByText("momentum")).not.toBeInTheDocument();
  });

  it("navigates to results on View Results click", async () => {
    renderWithStore(<StrategyCard strategy={fakeStrategy} />);
    await userEvent.click(screen.getByText("View Results"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/results/run-1");
  });

  it("disables View Results when no completed run", () => {
    renderWithStore(<StrategyCard strategy={strategyNoRuns} />);
    expect(screen.getByText("View Results")).toBeDisabled();
  });

  it("dispatches prefillFromStrategy and navigates on Duplicate click", async () => {
    const { store } = renderWithStore(
      <StrategyCard strategy={fakeStrategy} />,
    );
    await userEvent.click(screen.getByText("Duplicate"));

    expect(mockPush).toHaveBeenCalledWith("/dashboard/new");
    const builderState = store.getState().strategyBuilder;
    expect(builderState.ticker).toBe("SPY");
    expect(builderState.name).toBe("SPY Mean Reversion (Copy)");
    expect(builderState.strategyType).toBe("MEAN_REVERSION");
  });

  it("shows delete confirmation dialog", async () => {
    renderWithStore(<StrategyCard strategy={fakeStrategy} />);
    await userEvent.click(screen.getByText("Delete"));
    expect(
      screen.getByText(/permanently delete/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls deleteStrategy and dispatches removeStrategy on confirm", async () => {
    const { store } = renderWithStore(
      <StrategyCard strategy={fakeStrategy} />,
      {
        preloadedState: {
          workspace: {
            strategies: [fakeStrategy],
            loading: false,
            sortBy: "createdAt",
            sortDirection: "desc",
            filterType: null,
            filterTags: [],
          },
        },
      },
    );

    await userEvent.click(screen.getByText("Delete"));
    // Click the confirmation button inside the dialog
    const dialogActions = screen.getAllByText("Delete");
    const confirmBtn = dialogActions[dialogActions.length - 1];
    await userEvent.click(confirmBtn);

    expect(mockDeleteStrategy).toHaveBeenCalledWith("strat-1");
    expect(store.getState().workspace.strategies).toHaveLength(0);
    expect(mockToast.success).toHaveBeenCalledWith(
      "Strategy deleted successfully",
    );
  });

  it("shows error toast when delete fails", async () => {
    mockDeleteStrategy.mockRejectedValueOnce(new Error("fail"));
    renderWithStore(<StrategyCard strategy={fakeStrategy} />);

    await userEvent.click(screen.getByText("Delete"));
    const dialogActions = screen.getAllByText("Delete");
    const confirmBtn = dialogActions[dialogActions.length - 1];
    await userEvent.click(confirmBtn);

    expect(mockToast.error).toHaveBeenCalledWith(
      "Failed to delete strategy",
    );
  });

  it("toggles comparison checkbox", async () => {
    const { store } = renderWithStore(
      <StrategyCard strategy={fakeStrategy} />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /select.*comparison/i,
    });
    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);
    expect(store.getState().comparison.selectedIds).toContain("strat-1");
  });

  it("shows comparison checkbox as checked when strategy is selected", () => {
    renderWithStore(<StrategyCard strategy={fakeStrategy} />, {
      preloadedState: {
        comparison: {
          selectedIds: ["strat-1"],
          results: {},
        },
      },
    });

    const checkbox = screen.getByRole("checkbox", {
      name: /select.*comparison/i,
    });
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("renders negative return in red", () => {
    const lossStrategy: StrategyWithRuns = {
      ...fakeStrategy,
      runs: [
        {
          ...fakeStrategy.runs[0],
          results: {
            metrics: { ...fakeMetrics, total_return_pct: -15.2 },
            equity_curve: [],
            drawdown_series: [],
            monthly_returns: [],
            trades: [],
          },
        },
      ],
    };
    renderWithStore(<StrategyCard strategy={lossStrategy} />);
    const returnEl = screen.getByText("-15.20%");
    expect(returnEl.className).toMatch(/text-red/);
  });

  it("renders positive return in green", () => {
    renderWithStore(<StrategyCard strategy={fakeStrategy} />);
    const returnEl = screen.getByText("+25.50%");
    expect(returnEl.className).toMatch(/text-green/);
  });
});

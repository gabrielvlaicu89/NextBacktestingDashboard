/**
 * Tests for the Duplicate Strategy flow:
 * StrategyCard → dispatch prefillFromStrategy → navigate to /dashboard/new
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrategyCard } from "@/components/workspace/strategy-card";
import { renderWithStore } from "../helpers/render-with-store";
import type { StrategyWithRuns } from "@/lib/types";
 
const EMPTY_CUSTOM_STRATEGY = {
  version: 1 as const,
  name: "",
  description: "",
  indicators: [],
  longEntry: { type: "group" as const, operator: "AND" as const, conditions: [] },
  longExit: { type: "group" as const, operator: "AND" as const, conditions: [] },
  shortEntry: { type: "group" as const, operator: "AND" as const, conditions: [] },
  shortExit: { type: "group" as const, operator: "AND" as const, conditions: [] },
};

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

const sourceStrategy: StrategyWithRuns = {
  id: "original-1",
  userId: "user-1",
  name: "AAPL MA Crossover",
  type: "MA_CROSSOVER",
  ticker: "AAPL",
  benchmark: "QQQ",
  dateFrom: "2021-06-01T00:00:00.000Z",
  dateTo: "2023-12-31T00:00:00.000Z",
  parameters: { fast_period: 10, slow_period: 50, ma_type: "EMA" },
  riskSettings: {
    starting_capital: 25000,
    position_sizing_mode: "FIXED_DOLLAR",
    position_size: 5000,
    stop_loss_pct: 5,
    take_profit_pct: 15,
  },
  tags: ["tech", "momentum"],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  runs: [
    {
      id: "run-orig-1",
      strategyId: "original-1",
      userId: "user-1",
      status: "COMPLETED",
      results: {
        metrics: {
          total_return_pct: 22.3,
          annualized_return_pct: 9.5,
          max_drawdown_pct: -12.0,
          sharpe_ratio: 1.1,
          sortino_ratio: 1.6,
          win_rate_pct: 55.0,
          profit_factor: 1.35,
        },
        equity_curve: [],
        drawdown_series: [],
        monthly_returns: [],
        trades: [],
      },
      errorMsg: null,
      duration: 800,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Duplicate Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pre-fills the strategy builder with source data on Duplicate", async () => {
    const { store } = renderWithStore(
      <StrategyCard strategy={sourceStrategy} />,
    );

    await userEvent.click(screen.getByText("Duplicate"));

    const builder = store.getState().strategyBuilder;
    expect(builder.ticker).toBe("AAPL");
    expect(builder.strategyType).toBe("MA_CROSSOVER");
    expect(builder.benchmark).toBe("QQQ");
    expect(builder.dateFrom).toBe("2021-06-01T00:00:00.000Z");
    expect(builder.dateTo).toBe("2023-12-31T00:00:00.000Z");
    expect(builder.parameters).toEqual({
      fast_period: 10,
      slow_period: 50,
      ma_type: "EMA",
    });
    expect(builder.riskSettings).toEqual({
      starting_capital: 25000,
      position_sizing_mode: "FIXED_DOLLAR",
      position_size: 5000,
      stop_loss_pct: 5,
      take_profit_pct: 15,
    });
    expect(builder.tags).toEqual(["tech", "momentum"]);
  });

  it("appends (Copy) to the strategy name", async () => {
    const { store } = renderWithStore(
      <StrategyCard strategy={sourceStrategy} />,
    );

    await userEvent.click(screen.getByText("Duplicate"));
    expect(store.getState().strategyBuilder.name).toBe(
      "AAPL MA Crossover (Copy)",
    );
  });

  it("navigates to /dashboard/new after dispatching prefill", async () => {
    renderWithStore(<StrategyCard strategy={sourceStrategy} />);

    await userEvent.click(screen.getByText("Duplicate"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/new");
  });

  it("does not clear existing builder state before prefilling", async () => {
    const { store } = renderWithStore(
      <StrategyCard strategy={sourceStrategy} />,
      {
        preloadedState: {
          strategyBuilder: {
            ticker: "MSFT",
            dateFrom: "2019-01-01",
            dateTo: "2020-01-01",
            builderMode: "BUILT_IN",
            strategyType: "BUY_AND_HOLD",
            parameters: {},
            customStrategy: EMPTY_CUSTOM_STRATEGY,
            riskSettings: {
              starting_capital: 10000,
              position_sizing_mode: "PERCENT_PORTFOLIO",
              position_size: 100,
              stop_loss_pct: null,
              take_profit_pct: null,
            },
            benchmark: "SPY",
            name: "Old Strategy",
            tags: [],
          },
        },
      },
    );

    await userEvent.click(screen.getByText("Duplicate"));

    // After duplicate, builder should have the SOURCE strategy data, not the old data
    const builder = store.getState().strategyBuilder;
    expect(builder.ticker).toBe("AAPL");
    expect(builder.name).toBe("AAPL MA Crossover (Copy)");
    expect(builder.strategyType).toBe("MA_CROSSOVER");
    expect(builder.builderMode).toBe("BUILT_IN");
    expect(builder.customStrategy).toEqual(EMPTY_CUSTOM_STRATEGY);
  });
});

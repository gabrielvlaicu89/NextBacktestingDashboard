/**
 * Tests for ComparisonMetricsTable component.
 *
 * Verifies rendering, best-value highlighting, null metric handling,
 * and single-strategy edge cases.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ComparisonMetricsTable } from "@/components/comparison/comparison-metrics-table";
import type { StrategyWithRuns, BacktestResponse } from "@/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeStrategy(id: string, name: string): StrategyWithRuns {
  return {
    id,
    userId: "user-1",
    name,
    type: "MEAN_REVERSION",
    ticker: "SPY",
    benchmark: "SPY",
    dateFrom: "2020-01-01T00:00:00.000Z",
    dateTo: "2024-01-01T00:00:00.000Z",
    parameters: { window: 20 },
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

function makeMetrics(overrides: Partial<BacktestResponse["metrics"]> = {}): BacktestResponse["metrics"] {
  return {
    total_return_pct: 20.0,
    annualized_return_pct: 10.0,
    max_drawdown_pct: -5.0,
    sharpe_ratio: 1.2,
    sortino_ratio: 1.8,
    win_rate_pct: 60.0,
    profit_factor: 1.5,
    ...overrides,
  };
}

const stratA = makeStrategy("strat-a", "Strategy Alpha");
const stratB = makeStrategy("strat-b", "Strategy Beta");

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ComparisonMetricsTable", () => {
  // Rendering
  it("renders the table container", () => {
    render(
      <ComparisonMetricsTable
        items={[
          { strategy: stratA, metrics: makeMetrics() },
          { strategy: stratB, metrics: makeMetrics() },
        ]}
      />
    );
    expect(screen.getByTestId("comparison-metrics-table")).toBeInTheDocument();
  });

  it("renders a column header for each strategy", () => {
    render(
      <ComparisonMetricsTable
        items={[
          { strategy: stratA, metrics: makeMetrics() },
          { strategy: stratB, metrics: makeMetrics() },
        ]}
      />
    );
    expect(screen.getByText("Strategy Alpha")).toBeInTheDocument();
    expect(screen.getByText("Strategy Beta")).toBeInTheDocument();
  });

  it("renders all 7 metric row labels", () => {
    render(
      <ComparisonMetricsTable
        items={[{ strategy: stratA, metrics: makeMetrics() }]}
      />
    );
    expect(screen.getByTestId("metric-row-total_return_pct")).toBeInTheDocument();
    expect(screen.getByTestId("metric-row-annualized_return_pct")).toBeInTheDocument();
    expect(screen.getByTestId("metric-row-max_drawdown_pct")).toBeInTheDocument();
    expect(screen.getByTestId("metric-row-sharpe_ratio")).toBeInTheDocument();
    expect(screen.getByTestId("metric-row-sortino_ratio")).toBeInTheDocument();
    expect(screen.getByTestId("metric-row-win_rate_pct")).toBeInTheDocument();
    expect(screen.getByTestId("metric-row-profit_factor")).toBeInTheDocument();
  });

  it("renders metric cells for each strategy", () => {
    render(
      <ComparisonMetricsTable
        items={[
          { strategy: stratA, metrics: makeMetrics({ total_return_pct: 30.0 }) },
          { strategy: stratB, metrics: makeMetrics({ total_return_pct: 15.0 }) },
        ]}
      />
    );
    expect(screen.getByTestId("cell-total_return_pct-strat-a")).toBeInTheDocument();
    expect(screen.getByTestId("cell-total_return_pct-strat-b")).toBeInTheDocument();
  });

  it("formats total_return_pct as percentage with sign", () => {
    render(
      <ComparisonMetricsTable
        items={[{ strategy: stratA, metrics: makeMetrics({ total_return_pct: 25.5 }) }]}
      />
    );
    const cell = screen.getByTestId("cell-total_return_pct-strat-a");
    expect(cell).toHaveTextContent("+25.50%");
  });

  it("formats negative total_return_pct without plus sign", () => {
    render(
      <ComparisonMetricsTable
        items={[{ strategy: stratA, metrics: makeMetrics({ total_return_pct: -10.0 }) }]}
      />
    );
    const cell = screen.getByTestId("cell-total_return_pct-strat-a");
    expect(cell).toHaveTextContent("-10.00%");
  });

  // Best value highlighting
  it("highlights the best total_return_pct cell green", () => {
    render(
      <ComparisonMetricsTable
        items={[
          { strategy: stratA, metrics: makeMetrics({ total_return_pct: 30.0 }) },
          { strategy: stratB, metrics: makeMetrics({ total_return_pct: 15.0 }) },
        ]}
      />
    );
    const bestCell = screen.getByTestId("cell-total_return_pct-strat-a");
    expect(bestCell.className).toMatch(/green/);
  });

  it("does not highlight the worse total_return_pct cell", () => {
    render(
      <ComparisonMetricsTable
        items={[
          { strategy: stratA, metrics: makeMetrics({ total_return_pct: 30.0 }) },
          { strategy: stratB, metrics: makeMetrics({ total_return_pct: 15.0 }) },
        ]}
      />
    );
    const worseCell = screen.getByTestId("cell-total_return_pct-strat-b");
    expect(worseCell.className).not.toMatch(/green/);
  });

  it("highlights the best (least negative) max_drawdown_pct", () => {
    render(
      <ComparisonMetricsTable
        items={[
          { strategy: stratA, metrics: makeMetrics({ max_drawdown_pct: -2.0 }) },
          { strategy: stratB, metrics: makeMetrics({ max_drawdown_pct: -20.0 }) },
        ]}
      />
    );
    // -2 > -20, so stratA is best
    const bestCell = screen.getByTestId("cell-max_drawdown_pct-strat-a");
    expect(bestCell.className).toMatch(/green/);
  });

  // Null / missing metrics
  it("renders '—' for null metrics", () => {
    render(
      <ComparisonMetricsTable
        items={[
          { strategy: stratA, metrics: undefined },
          { strategy: stratB, metrics: makeMetrics() },
        ]}
      />
    );
    const nullCell = screen.getByTestId("cell-total_return_pct-strat-a");
    expect(nullCell).toHaveTextContent("—");
  });

  it("does not highlight when only one strategy has defined metrics", () => {
    render(
      <ComparisonMetricsTable
        items={[
          { strategy: stratA, metrics: undefined },
          { strategy: stratB, metrics: makeMetrics({ total_return_pct: 50.0 }) },
        ]}
      />
    );
    const definedCell = screen.getByTestId("cell-total_return_pct-strat-b");
    // With only 1 defined value, no highlight should be applied
    expect(definedCell.className).not.toMatch(/green/);
  });

  // Single strategy
  it("renders correctly with a single strategy (no highlight)", () => {
    render(
      <ComparisonMetricsTable
        items={[{ strategy: stratA, metrics: makeMetrics() }]}
      />
    );
    const cell = screen.getByTestId("cell-sharpe_ratio-strat-a");
    expect(cell.className).not.toMatch(/green/);
  });
});

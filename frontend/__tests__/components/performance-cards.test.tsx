/**
 * Tests for PerformanceCards component.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerformanceCards, METRIC_DEFS } from "@/components/results/performance-cards";
import type { PerformanceMetrics } from "@/lib/types";

const mockMetrics: PerformanceMetrics = {
  total_return_pct: 25.5,
  annualized_return_pct: 12.75,
  max_drawdown_pct: -15.3,
  sharpe_ratio: 1.45,
  sortino_ratio: 2.1,
  win_rate_pct: 62.5,
  profit_factor: 1.85,
};

const negativeMetrics: PerformanceMetrics = {
  total_return_pct: -10.2,
  annualized_return_pct: -5.1,
  max_drawdown_pct: -25.8,
  sharpe_ratio: -0.5,
  sortino_ratio: -0.3,
  win_rate_pct: 35.0,
  profit_factor: 0.6,
};

describe("PerformanceCards", () => {
  it("renders the performance cards container", () => {
    render(<PerformanceCards metrics={mockMetrics} />);
    expect(screen.getByTestId("performance-cards")).toBeInTheDocument();
  });

  it("renders all 7 metric cards", () => {
    render(<PerformanceCards metrics={mockMetrics} />);
    for (const def of METRIC_DEFS) {
      expect(screen.getByTestId(`metric-${def.key}`)).toBeInTheDocument();
    }
  });

  it("renders correct metric labels", () => {
    render(<PerformanceCards metrics={mockMetrics} />);
    for (const def of METRIC_DEFS) {
      expect(screen.getByText(def.label)).toBeInTheDocument();
    }
  });

  it("formats total return with + sign for positive values", () => {
    render(<PerformanceCards metrics={mockMetrics} />);
    expect(screen.getByTestId("metric-value-total_return_pct")).toHaveTextContent("+25.50%");
  });

  it("formats total return with - sign for negative values", () => {
    render(<PerformanceCards metrics={negativeMetrics} />);
    expect(screen.getByTestId("metric-value-total_return_pct")).toHaveTextContent("-10.20%");
  });

  it("formats sharpe ratio as decimal", () => {
    render(<PerformanceCards metrics={mockMetrics} />);
    expect(screen.getByTestId("metric-value-sharpe_ratio")).toHaveTextContent("1.45");
  });

  it("formats win rate with one decimal", () => {
    render(<PerformanceCards metrics={mockMetrics} />);
    expect(screen.getByTestId("metric-value-win_rate_pct")).toHaveTextContent("62.5%");
  });

  it("formats drawdown as percentage", () => {
    render(<PerformanceCards metrics={mockMetrics} />);
    expect(screen.getByTestId("metric-value-max_drawdown_pct")).toHaveTextContent("-15.30%");
  });

  it("applies green color class for positive total return", () => {
    render(<PerformanceCards metrics={mockMetrics} />);
    const el = screen.getByTestId("metric-value-total_return_pct");
    const classes = el.className.split(/\s+/);
    expect(classes.some((c) => c.includes("green"))).toBe(true);
  });

  it("applies red color class for negative total return", () => {
    render(<PerformanceCards metrics={negativeMetrics} />);
    const el = screen.getByTestId("metric-value-total_return_pct");
    const classes = el.className.split(/\s+/);
    expect(classes.some((c) => c.includes("red"))).toBe(true);
  });

  it("applies green color class for negative drawdown (inverted)", () => {
    // Drawdown is inverted: negative drawdown is "good" (green)
    render(<PerformanceCards metrics={mockMetrics} />);
    const el = screen.getByTestId("metric-value-max_drawdown_pct");
    const classes = el.className.split(/\s+/);
    expect(classes.some((c) => c.includes("green"))).toBe(true);
  });

  it("has correct number of METRIC_DEFS", () => {
    expect(METRIC_DEFS).toHaveLength(7);
  });
});

/**
 * Tests for TradeDistributionChart component and bucketTrades utility.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TradeDistributionChart,
  bucketTrades,
} from "@/components/results/trade-distribution-chart";
import type { TradeResult } from "@/lib/types";

// Mock recharts to avoid DOM measurement issues in jsdom
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

const mockTrades: TradeResult[] = [
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
  {
    entry_date: "2023-02-01",
    exit_date: "2023-02-15",
    entry_price: 110,
    exit_price: 105,
    pnl: -500,
    pnl_pct: -4.55,
    holding_days: 14,
    exit_reason: "stop_loss",
  },
  {
    entry_date: "2023-03-01",
    exit_date: "2023-03-10",
    entry_price: 105,
    exit_price: 107,
    pnl: 200,
    pnl_pct: 1.9,
    holding_days: 9,
    exit_reason: "signal",
  },
  {
    entry_date: "2023-04-01",
    exit_date: "2023-04-15",
    entry_price: 107,
    exit_price: 100,
    pnl: -700,
    pnl_pct: -6.54,
    holding_days: 14,
    exit_reason: "stop_loss",
  },
];

describe("TradeDistributionChart", () => {
  it("renders the chart container with trades", () => {
    render(<TradeDistributionChart trades={mockTrades} />);
    expect(screen.getByTestId("trade-distribution-chart")).toBeInTheDocument();
  });

  it("renders empty state with no trades", () => {
    render(<TradeDistributionChart trades={[]} />);
    expect(screen.getByText("No trades to display.")).toBeInTheDocument();
  });

  it("renders the title", () => {
    render(<TradeDistributionChart trades={mockTrades} />);
    expect(screen.getByText("Trade Distribution")).toBeInTheDocument();
  });

  it("renders the responsive container", () => {
    render(<TradeDistributionChart trades={mockTrades} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});

describe("bucketTrades", () => {
  it("returns empty array for no trades", () => {
    expect(bucketTrades([])).toEqual([]);
  });

  it("creates buckets with 5% step", () => {
    const buckets = bucketTrades(mockTrades);
    // Trades range from -6.54% to 8.0%
    // Buckets: -10 to -5, -5 to 0, 0 to 5, 5 to 10
    expect(buckets.length).toBeGreaterThanOrEqual(3);
  });

  it("marks profit buckets correctly", () => {
    const buckets = bucketTrades(mockTrades);
    const profitBuckets = buckets.filter((b) => b.isProfit);
    const lossBuckets = buckets.filter((b) => !b.isProfit);
    expect(profitBuckets.length).toBeGreaterThan(0);
    expect(lossBuckets.length).toBeGreaterThan(0);
  });

  it("assigns correct counts to buckets", () => {
    const buckets = bucketTrades(mockTrades);
    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(mockTrades.length);
  });

  it("handles single trade", () => {
    const buckets = bucketTrades([mockTrades[0]]);
    expect(buckets.length).toBeGreaterThanOrEqual(1);
    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(1);
  });
});

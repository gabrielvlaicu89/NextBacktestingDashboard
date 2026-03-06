/**
 * Tests for TradeLogTable component.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradeLogTable } from "@/components/results/trade-log-table";
import type { TradeResult } from "@/lib/types";

function makeTrade(overrides: Partial<TradeResult> = {}): TradeResult {
  return {
    entry_date: "2023-01-10",
    exit_date: "2023-01-20",
    entry_price: 100,
    exit_price: 108,
    pnl: 800,
    pnl_pct: 8.0,
    holding_days: 10,
    exit_reason: "signal",
    ...overrides,
  };
}

const fewTrades: TradeResult[] = [
  makeTrade({ entry_date: "2023-01-10", pnl: 800, pnl_pct: 8.0 }),
  makeTrade({ entry_date: "2023-02-01", pnl: -500, pnl_pct: -4.55, exit_reason: "stop_loss" }),
  makeTrade({ entry_date: "2023-03-01", pnl: 200, pnl_pct: 1.9 }),
];

// Generate 25 trades for pagination testing
const manyTrades: TradeResult[] = Array.from({ length: 25 }, (_, i) =>
  makeTrade({
    entry_date: `2023-01-${String(i + 1).padStart(2, "0")}`,
    pnl: i % 2 === 0 ? 100 * (i + 1) : -50 * (i + 1),
    pnl_pct: i % 2 === 0 ? (i + 1) : -(i + 1) * 0.5,
  })
);

describe("TradeLogTable", () => {
  it("renders the table container with trades", () => {
    render(<TradeLogTable trades={fewTrades} />);
    expect(screen.getByTestId("trade-log-table")).toBeInTheDocument();
  });

  it("renders empty state with no trades", () => {
    render(<TradeLogTable trades={[]} />);
    expect(screen.getByText("No trades recorded.")).toBeInTheDocument();
  });

  it("shows trade count in title", () => {
    render(<TradeLogTable trades={fewTrades} />);
    expect(screen.getByText("(3 trades)")).toBeInTheDocument();
  });

  it("renders all column headers", () => {
    render(<TradeLogTable trades={fewTrades} />);
    expect(screen.getByText("Entry Date")).toBeInTheDocument();
    expect(screen.getByText("Exit Date")).toBeInTheDocument();
    expect(screen.getByText("Entry Price")).toBeInTheDocument();
    expect(screen.getByText("Exit Price")).toBeInTheDocument();
    expect(screen.getByText("Exit Reason")).toBeInTheDocument();
  });

  it("renders sortable column buttons", () => {
    render(<TradeLogTable trades={fewTrades} />);
    // P&L ($), P&L (%), Days, Entry Date, Exit Date are sortable
    const sortButtons = screen.getAllByRole("button");
    // At least sortable header buttons + pagination buttons
    expect(sortButtons.length).toBeGreaterThanOrEqual(5);
  });

  it("renders trade rows", () => {
    render(<TradeLogTable trades={fewTrades} />);
    expect(screen.getByTestId("trade-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("trade-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("trade-row-2")).toBeInTheDocument();
  });

  it("formats entry price with dollar sign", () => {
    render(<TradeLogTable trades={fewTrades} />);
    // Multiple rows may share the same entry price
    const cells = screen.getAllByText("$100.00");
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("formats positive P&L with green color and + sign", () => {
    render(<TradeLogTable trades={fewTrades} />);
    const positiveCell = screen.getByText("+$800.00");
    expect(positiveCell).toBeInTheDocument();
    const classes = positiveCell.className.split(/\s+/);
    expect(classes.some((c) => c.includes("green"))).toBe(true);
  });

  it("formats negative P&L with red color", () => {
    render(<TradeLogTable trades={fewTrades} />);
    // Template: {val >= 0 ? "+" : ""}${val.toFixed(2)} → "$-500.00"
    const negativeCell = screen.getByText("$-500.00");
    expect(negativeCell).toBeInTheDocument();
    const classes = negativeCell.className.split(/\s+/);
    expect(classes.some((c) => c.includes("red"))).toBe(true);
  });

  it("shows exit reason", () => {
    render(<TradeLogTable trades={fewTrades} />);
    expect(screen.getByText("stop_loss")).toBeInTheDocument();
  });

  it("paginates with default page size of 10", () => {
    render(<TradeLogTable trades={manyTrades} />);
    // Should show page 1 of 3 (25 trades / 10 per page)
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("navigates to next page", () => {
    render(<TradeLogTable trades={manyTrades} />);
    const nextButton = screen.getByTestId("trade-log-next");
    fireEvent.click(nextButton);
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("navigates back to previous page", () => {
    render(<TradeLogTable trades={manyTrades} />);
    // Go to page 2
    fireEvent.click(screen.getByTestId("trade-log-next"));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

    // Go back to page 1
    fireEvent.click(screen.getByTestId("trade-log-prev"));
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("disables previous button on first page", () => {
    render(<TradeLogTable trades={manyTrades} />);
    expect(screen.getByTestId("trade-log-prev")).toBeDisabled();
  });

  it("supports custom page size", () => {
    render(<TradeLogTable trades={manyTrades} pageSize={5} />);
    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
  });
});

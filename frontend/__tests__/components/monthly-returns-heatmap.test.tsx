/**
 * Tests for MonthlyReturnsHeatmap component.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MonthlyReturnsHeatmap,
  MONTH_LABELS,
  getCellColor,
} from "@/components/results/monthly-returns-heatmap";

const mockData = [
  { year: 2023, month: 1, return_pct: 3.5 },
  { year: 2023, month: 2, return_pct: -1.2 },
  { year: 2023, month: 6, return_pct: 5.0 },
  { year: 2024, month: 1, return_pct: -4.0 },
  { year: 2024, month: 3, return_pct: 2.1 },
];

describe("MonthlyReturnsHeatmap", () => {
  it("renders the heatmap container", () => {
    render(<MonthlyReturnsHeatmap data={mockData} />);
    expect(screen.getByTestId("monthly-returns-heatmap")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(<MonthlyReturnsHeatmap data={[]} />);
    expect(screen.getByText("No monthly return data available.")).toBeInTheDocument();
  });

  it("renders all 12 month column headers", () => {
    render(<MonthlyReturnsHeatmap data={mockData} />);
    for (const label of MONTH_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders year row labels", () => {
    render(<MonthlyReturnsHeatmap data={mockData} />);
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
  });

  it("renders cells with correct values", () => {
    render(<MonthlyReturnsHeatmap data={mockData} />);
    expect(screen.getByTestId("heatmap-cell-2023-1")).toHaveTextContent("3.5%");
    expect(screen.getByTestId("heatmap-cell-2023-2")).toHaveTextContent("-1.2%");
  });

  it("renders dash for missing months", () => {
    render(<MonthlyReturnsHeatmap data={mockData} />);
    // Month 4 of 2023 has no data, should show —
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("has correct title", () => {
    render(<MonthlyReturnsHeatmap data={mockData} />);
    expect(screen.getByText("Monthly Returns")).toBeInTheDocument();
  });
});

describe("getCellColor", () => {
  it("returns green-tinted rgba for positive values", () => {
    const color = getCellColor(5);
    expect(color).toContain("34, 197, 94");
  });

  it("returns red-tinted rgba for negative values", () => {
    const color = getCellColor(-5);
    expect(color).toContain("239, 68, 68");
  });

  it("returns transparent for zero", () => {
    expect(getCellColor(0)).toBe("transparent");
  });

  it("caps intensity at 20%", () => {
    const color20 = getCellColor(20);
    const color50 = getCellColor(50);
    expect(color20).toBe(color50);
  });
});

describe("MONTH_LABELS", () => {
  it("has 12 entries", () => {
    expect(MONTH_LABELS).toHaveLength(12);
  });

  it("starts with Jan and ends with Dec", () => {
    expect(MONTH_LABELS[0]).toBe("Jan");
    expect(MONTH_LABELS[11]).toBe("Dec");
  });
});

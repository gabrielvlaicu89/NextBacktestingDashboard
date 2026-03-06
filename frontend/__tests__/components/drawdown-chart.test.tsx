/**
 * Tests for DrawdownChart component.
 *
 * Mocks lightweight-charts since it requires a real browser DOM.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DrawdownChart } from "@/components/results/drawdown-chart";

// Mock lightweight-charts
const mockSetData = vi.fn();
const mockFitContent = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemove = vi.fn();
const mockAddSeries = vi.fn(() => ({ setData: mockSetData }));

vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => ({
    addSeries: mockAddSeries,
    timeScale: () => ({ fitContent: mockFitContent }),
    applyOptions: mockApplyOptions,
    remove: mockRemove,
  })),
  AreaSeries: "AreaSeries",
  ColorType: { Solid: "Solid" },
}));

const sampleData = [
  { date: "2023-01-01", drawdown_pct: 0 },
  { date: "2023-01-02", drawdown_pct: -2.5 },
  { date: "2023-01-03", drawdown_pct: -5.8 },
  { date: "2023-01-04", drawdown_pct: -1.2 },
];

describe("DrawdownChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the card container with data", () => {
    render(<DrawdownChart data={sampleData} />);
    expect(screen.getByTestId("drawdown-chart")).toBeInTheDocument();
  });

  it("displays the title", () => {
    render(<DrawdownChart data={sampleData} />);
    expect(screen.getByText("Drawdown")).toBeInTheDocument();
  });

  it("renders the chart container div", () => {
    render(<DrawdownChart data={sampleData} />);
    expect(screen.getByTestId("drawdown-container")).toBeInTheDocument();
  });

  it("renders empty state with no data", () => {
    render(<DrawdownChart data={[]} />);
    expect(screen.getByText("No drawdown data available.")).toBeInTheDocument();
    expect(screen.queryByTestId("drawdown-chart")).not.toBeInTheDocument();
  });

  it("creates one area series", () => {
    render(<DrawdownChart data={sampleData} />);
    expect(mockAddSeries).toHaveBeenCalledTimes(1);
  });

  it("sets data on the series", () => {
    render(<DrawdownChart data={sampleData} />);
    expect(mockSetData).toHaveBeenCalledOnce();
  });

  it("calls fitContent on the time scale", () => {
    render(<DrawdownChart data={sampleData} />);
    expect(mockFitContent).toHaveBeenCalledOnce();
  });
});

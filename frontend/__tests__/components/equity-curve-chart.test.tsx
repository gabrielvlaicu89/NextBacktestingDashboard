/**
 * Tests for EquityCurveChart component.
 *
 * Mocks lightweight-charts since it requires a real browser DOM.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EquityCurveChart } from "@/components/results/equity-curve-chart";

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
  LineSeries: "LineSeries",
  ColorType: { Solid: "Solid" },
}));

const sampleData = [
  { date: "2023-01-01", value: 10000, benchmark_value: 10000 },
  { date: "2023-01-02", value: 10200, benchmark_value: 10100 },
  { date: "2023-01-03", value: 10150, benchmark_value: 10050 },
];

describe("EquityCurveChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the card container with data", () => {
    render(<EquityCurveChart data={sampleData} />);
    expect(screen.getByTestId("equity-curve-chart")).toBeInTheDocument();
  });

  it("displays the title", () => {
    render(<EquityCurveChart data={sampleData} />);
    expect(screen.getByText("Equity Curve")).toBeInTheDocument();
  });

  it("renders the chart container div", () => {
    render(<EquityCurveChart data={sampleData} />);
    expect(screen.getByTestId("equity-curve-container")).toBeInTheDocument();
  });

  it("renders the portfolio legend item", () => {
    render(<EquityCurveChart data={sampleData} />);
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
  });

  it("renders the benchmark legend item", () => {
    render(<EquityCurveChart data={sampleData} />);
    expect(screen.getByText("Benchmark")).toBeInTheDocument();
  });

  it("renders empty state with no data", () => {
    render(<EquityCurveChart data={[]} />);
    expect(screen.getByText("No equity data available.")).toBeInTheDocument();
    expect(screen.queryByTestId("equity-curve-chart")).not.toBeInTheDocument();
  });

  it("creates two series (portfolio + benchmark)", () => {
    render(<EquityCurveChart data={sampleData} />);
    expect(mockAddSeries).toHaveBeenCalledTimes(2);
  });

  it("sets data on both series", () => {
    render(<EquityCurveChart data={sampleData} />);
    expect(mockSetData).toHaveBeenCalledTimes(2);
  });

  it("calls fitContent on the time scale", () => {
    render(<EquityCurveChart data={sampleData} />);
    expect(mockFitContent).toHaveBeenCalledOnce();
  });
});

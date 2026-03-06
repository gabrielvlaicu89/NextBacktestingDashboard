/**
 * Tests for ComparisonEquityChart component.
 *
 * Mocks lightweight-charts (requires real browser DOM).
 * Verifies legend rendering, series creation, empty state, and normalization.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ComparisonEquityChart,
  COMPARISON_COLORS,
  type EquitySeries,
} from "@/components/comparison/comparison-equity-chart";

// ── Mock lightweight-charts ────────────────────────────────────────────────────

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockFitContent = vi.fn();
const mockRemove = vi.fn();
const mockAddSeries = vi.fn(() => ({ setData: mockSetData, applyOptions: mockApplyOptions }));

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

// ── Test data ──────────────────────────────────────────────────────────────────

const makeSeriesData = (id: string, name: string, color: string): EquitySeries => ({
  id,
  name,
  color,
  data: [
    { date: "2023-01-01", value: 10000 },
    { date: "2023-01-02", value: 10500 },
    { date: "2023-01-03", value: 11000 },
  ],
});

const seriesA = makeSeriesData("strat-a", "Strategy Alpha", COMPARISON_COLORS[0]);
const seriesB = makeSeriesData("strat-b", "Strategy Beta", COMPARISON_COLORS[1]);

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ComparisonEquityChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Rendering
  it("renders the chart container", () => {
    render(<ComparisonEquityChart series={[seriesA, seriesB]} />);
    expect(screen.getByTestId("comparison-equity-chart")).toBeInTheDocument();
  });

  it("renders the chart legend", () => {
    render(<ComparisonEquityChart series={[seriesA, seriesB]} />);
    expect(screen.getByTestId("chart-legend")).toBeInTheDocument();
  });

  it("renders a legend item for each series", () => {
    render(<ComparisonEquityChart series={[seriesA, seriesB]} />);
    expect(screen.getByText("Strategy Alpha")).toBeInTheDocument();
    expect(screen.getByText("Strategy Beta")).toBeInTheDocument();
  });

  it("renders with a single series", () => {
    render(<ComparisonEquityChart series={[seriesA]} />);
    expect(screen.getByTestId("comparison-equity-chart")).toBeInTheDocument();
    expect(screen.getByText("Strategy Alpha")).toBeInTheDocument();
  });

  // Empty state
  it("renders empty state when no series provided", () => {
    render(<ComparisonEquityChart series={[]} />);
    expect(screen.getByText(/no equity data/i)).toBeInTheDocument();
    expect(screen.queryByTestId("comparison-equity-chart")).not.toBeInTheDocument();
  });

  // Lightweight Charts interactions
  it("creates one series per data series", () => {
    render(<ComparisonEquityChart series={[seriesA, seriesB]} />);
    expect(mockAddSeries).toHaveBeenCalledTimes(2);
  });

  it("calls setData for each series", () => {
    render(<ComparisonEquityChart series={[seriesA, seriesB]} />);
    expect(mockSetData).toHaveBeenCalledTimes(2);
  });

  it("calls fitContent on the time scale", () => {
    render(<ComparisonEquityChart series={[seriesA]} />);
    expect(mockFitContent).toHaveBeenCalled();
  });

  it("normalises data to base 100 for each series", () => {
    render(<ComparisonEquityChart series={[seriesA]} />);
    // First call to setData should have normalised values where first point = 100
    const callArgs = mockSetData.mock.calls[0][0] as { value: number }[];
    expect(callArgs[0].value).toBeCloseTo(100, 1);
    expect(callArgs[1].value).toBeCloseTo(105, 1); // 10500/10000 * 100
    expect(callArgs[2].value).toBeCloseTo(110, 1); // 11000/10000 * 100
  });

  it("cleans up chart on unmount", () => {
    const { unmount } = render(<ComparisonEquityChart series={[seriesA]} />);
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  // Colour palette
  it("COMPARISON_COLORS exports 5 colours", () => {
    expect(COMPARISON_COLORS).toHaveLength(5);
    COMPARISON_COLORS.forEach((c) => {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

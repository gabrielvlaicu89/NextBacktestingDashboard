/**
 * Tests for OptimizeResults component.
 *
 * Verifies:
 *  - 1 swept param → line chart rendered
 *  - 2 swept params → heatmap rendered
 *  - 3+ swept params → sortable table rendered
 *  - click handlers fire onRunConfig with the right params
 *  - empty results state
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OptimizeResults } from "@/components/optimization/optimize-results";
import type { OptimizeResultEntry } from "@/lib/types";

// ── Mock Recharts (not a full DOM environment) ─────────────────────────────────

vi.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "responsive-container" }, children),
    LineChart: ({ children, onClick, data }: { children: React.ReactNode; onClick?: (e: unknown) => void; data?: unknown[] }) =>
      React.createElement(
        "div",
        { "data-testid": "line-chart", onClick: () => onClick?.({ activePayload: data ? [{ payload: data[0] }] : [] }) },
        children
      ),
    Line: () => React.createElement("div", { "data-testid": "recharts-line" }),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

// ── Test data ──────────────────────────────────────────────────────────────────

/** One swept param (window) */
const oneParamResults: OptimizeResultEntry[] = [
  { params: { window: 10 }, metric: 0.8 },
  { params: { window: 20 }, metric: 1.2 },
  { params: { window: 30 }, metric: 0.95 },
];

/** Two swept params */
const twoParamResults: OptimizeResultEntry[] = [
  { params: { fast: 5,  slow: 20 }, metric: 1.1 },
  { params: { fast: 5,  slow: 50 }, metric: 1.4 },
  { params: { fast: 10, slow: 20 }, metric: 0.9 },
  { params: { fast: 10, slow: 50 }, metric: 1.3 },
];

/** Three swept params */
const threeParamResults: OptimizeResultEntry[] = [
  { params: { a: 1, b: 2, c: 3 }, metric: 0.5 },
  { params: { a: 2, b: 3, c: 4 }, metric: 1.0 },
  { params: { a: 3, b: 4, c: 5 }, metric: 0.8 },
];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("OptimizeResults", () => {
  let onRunConfig: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRunConfig = vi.fn();
  });

  // Empty state
  it("renders empty state message when no results", () => {
    render(
      <OptimizeResults
        results={[]}
        optimizeFor="sharpe_ratio"
        paramKeys={[]}
        onRunConfig={onRunConfig}
      />
    );
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  // 1-param: line chart
  it("renders a line chart for 1 swept param", () => {
    render(
      <OptimizeResults
        results={oneParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["window"]}
        onRunConfig={onRunConfig}
      />
    );
    expect(screen.getByTestId("optimize-results-chart")).toBeInTheDocument();
  });

  it("does not render heatmap or table for 1 swept param", () => {
    render(
      <OptimizeResults
        results={oneParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["window"]}
        onRunConfig={onRunConfig}
      />
    );
    expect(screen.queryByTestId("optimize-results-heatmap")).not.toBeInTheDocument();
    expect(screen.queryByTestId("optimize-results-table")).not.toBeInTheDocument();
  });

  it("shows the result count in the header", () => {
    render(
      <OptimizeResults
        results={oneParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["window"]}
        onRunConfig={onRunConfig}
      />
    );
    expect(screen.getByText(/3 combinations/i)).toBeInTheDocument();
  });

  // 2-params: heatmap
  it("renders a heatmap for 2 swept params", () => {
    render(
      <OptimizeResults
        results={twoParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["fast", "slow"]}
        onRunConfig={onRunConfig}
      />
    );
    expect(screen.getByTestId("optimize-results-heatmap")).toBeInTheDocument();
  });

  it("does not render chart or table for 2 swept params", () => {
    render(
      <OptimizeResults
        results={twoParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["fast", "slow"]}
        onRunConfig={onRunConfig}
      />
    );
    expect(screen.queryByTestId("optimize-results-chart")).not.toBeInTheDocument();
    expect(screen.queryByTestId("optimize-results-table")).not.toBeInTheDocument();
  });

  it("renders heatmap axis headers from param keys", () => {
    render(
      <OptimizeResults
        results={twoParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["fast", "slow"]}
        onRunConfig={onRunConfig}
      />
    );
    expect(screen.getByText(/fast/i)).toBeInTheDocument();
    expect(screen.getByText(/slow/i)).toBeInTheDocument();
  });

  it("calls onRunConfig when a heatmap cell is clicked", async () => {
    const user = userEvent.setup();
    render(
      <OptimizeResults
        results={twoParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["fast", "slow"]}
        onRunConfig={onRunConfig}
      />
    );
    // Click any cell in the heatmap
    const heatmap = screen.getByTestId("optimize-results-heatmap");
    const firstCell = within(heatmap).getAllByRole("cell").find((c) => c.getAttribute("title")?.includes("sharpe_ratio"));
    if (firstCell) await user.click(firstCell);
    expect(onRunConfig).toHaveBeenCalled();
  });

  // 3+ params: table
  it("renders a sortable table for 3 swept params", () => {
    render(
      <OptimizeResults
        results={threeParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["a", "b", "c"]}
        onRunConfig={onRunConfig}
      />
    );
    expect(screen.getByTestId("optimize-results-table")).toBeInTheDocument();
  });

  it("does not render chart or heatmap for 3 swept params", () => {
    render(
      <OptimizeResults
        results={threeParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["a", "b", "c"]}
        onRunConfig={onRunConfig}
      />
    );
    expect(screen.queryByTestId("optimize-results-chart")).not.toBeInTheDocument();
    expect(screen.queryByTestId("optimize-results-heatmap")).not.toBeInTheDocument();
  });

  it("renders one row per result in the table", () => {
    render(
      <OptimizeResults
        results={threeParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["a", "b", "c"]}
        onRunConfig={onRunConfig}
      />
    );
    const rows = screen.getAllByText(/Use/);
    expect(rows).toHaveLength(threeParamResults.length);
  });

  it("calls onRunConfig with correct params when Use button clicked", async () => {
    const user = userEvent.setup();
    render(
      <OptimizeResults
        results={threeParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["a", "b", "c"]}
        onRunConfig={onRunConfig}
      />
    );
    await user.click(screen.getAllByRole("button", { name: /Use/i })[0]);
    expect(onRunConfig).toHaveBeenCalledOnce();
    expect(onRunConfig.mock.calls[0][0]).toHaveProperty("a");
  });

  it("renders sort buttons for each column in the table", () => {
    render(
      <OptimizeResults
        results={threeParamResults}
        optimizeFor="sharpe_ratio"
        paramKeys={["a", "b", "c"]}
        onRunConfig={onRunConfig}
      />
    );
    // 3 param columns + 1 metric column = 4 sort buttons
    const sortButtons = screen.getAllByRole("button", { name: /.+/ }).filter(
      (btn) => !btn.textContent?.includes("Use")
    );
    expect(sortButtons.length).toBeGreaterThanOrEqual(4);
  });

  it("filters out null metric entries in chart data", () => {
    const resultsWithNull: OptimizeResultEntry[] = [
      { params: { window: 10 }, metric: null },
      { params: { window: 20 }, metric: 1.5 },
    ];
    render(
      <OptimizeResults
        results={resultsWithNull}
        optimizeFor="sharpe_ratio"
        paramKeys={["window"]}
        onRunConfig={onRunConfig}
      />
    );
    // Should render chart without crashing
    expect(screen.getByTestId("optimize-results-chart")).toBeInTheDocument();
  });
});

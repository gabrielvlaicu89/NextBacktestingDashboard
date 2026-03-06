# Lesson 36 — Strategy Comparison: Multi-Series Data Flow and Best-Value Highlighting

Comparing multiple backtested strategies side-by-side is one of the most valuable features in a trading platform. It forces you to solve a problem that single-strategy views don't encounter: **how do you fetch, normalize, and render N independent datasets in a single coordinated view?** This lesson covers the full data pipeline — from URL query parameters to a transposed metrics table with automatic best-value detection, to overlaid equity curves normalized to a common baseline.

---

## Section: The Architecture — Server Component Orchestrates, Client Components Render

The comparison page follows a pattern we established in Phase 7: a Server Component does all the data fetching, then passes serialized data down to Client Components for interactive rendering. But this time there is a twist — the page receives a **variable number** of strategy IDs via query params.

```
┌──────────────────────────────────────────────────────────────┐
│  URL: /dashboard/compare?ids=id1,id2,id3                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ComparePage (Server Component)                              │
│  ├── Parse ?ids= query string                                │
│  ├── getStrategiesByIds(ids) — Prisma batch query            │
│  ├── Build items[]: { strategy, metrics, equityCurve }       │
│  ├── Build equitySeries[] for chart                          │
│  │                                                           │
│  ├──► ComparisonMetricsTable (Client)                        │
│  │       Rows = 7 metric definitions                         │
│  │       Cols = N strategies                                 │
│  │       Highlights best value per row                       │
│  │                                                           │
│  └──► ComparisonEquityChart (Client)                         │
│          N LineSeries, each normalized to base 100            │
│          Legend with color swatches                           │
└──────────────────────────────────────────────────────────────┘
```

### Why the Server Component Does the Heavy Lifting

The alternative is passing raw strategy IDs to a Client Component and letting it call `fetch()` itself. That approach has three downsides:

1. **Loading waterfall** — the client would need to render, then fire a request, then re-render with data
2. **Auth complexity** — calling a server action from a Client Component requires special handling; calling Prisma directly in a Server Component is trivial
3. **SEO/streaming** — the Server Component can start streaming the shell while the database query resolves

### The `getStrategiesByIds` Action

This server action demonstrates an important database pattern — **preserving input order**:

```typescript
// lib/actions/strategies.ts
export async function getStrategiesByIds(ids: string[]): Promise<StrategyWithRuns[]> {
  const strategies = await prisma.strategy.findMany({
    where: { id: { in: ids }, userId: session.user.id },
    include: { runs: { orderBy: { createdAt: "desc" } } },
  });

  // Prisma's `in` doesn't guarantee order — re-sort to match input
  const byId = Object.fromEntries(strategies.map((s) => [s.id, s]));
  return ids
    .map((id) => byId[id])
    .filter(Boolean)
    .map((s) => ({ ...serialiseStrategy(s), runs: /* ... */ }));
}
```

Prisma's `findMany({ where: { id: { in: ids } } })` returns results in whatever order the database engine chooses. For a comparison page, the column order must match the URL order (which in turn matches the order the user selected checkboxes in the workspace). The `byId` lookup + re-map pattern solves this in O(n) time.

---

## Section: The Transposed Metrics Table — Rows Are Metrics, Columns Are Strategies

A typical data table has rows as records and columns as fields. The comparison table flips this — each row is a metric like "Sharpe Ratio" and each column is a strategy. This "transposed" layout makes visual scanning natural: your eye moves left-to-right across strategies for any single metric.

### Metric Definitions as Data

Instead of hardcoding each row, the component defines metrics as a typed array:

```typescript
interface MetricDef {
  key: keyof BacktestResponse["metrics"];  // type-safe key
  label: string;                            // human-readable row label
  format: (v: number) => string;           // number → display string
  higherIsBetter: boolean;                  // used for best-value logic
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: "total_return_pct",
    label: "Total Return",
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
    higherIsBetter: true,
  },
  // ... 6 more
];
```

This is a data-driven approach. Adding a new metric requires only appending to the array — no JSX changes. The `key` field is typed as `keyof BacktestResponse["metrics"]`, which means TypeScript will catch any typo or reference to a metric that doesn't exist in the response schema.

### Best-Value Highlighting

For each metric row, the code computes which strategy has the best value:

```typescript
const values = items.map((item) =>
  item.metrics != null ? item.metrics[def.key] : null,
);
const defined = values.filter((v): v is number => v !== null);
const bestValue = defined.length > 0 ? Math.max(...defined) : null;
```

Then in the JSX, each cell checks:

```typescript
const isBest =
  raw !== null &&
  bestValue !== null &&
  raw === bestValue &&
  defined.length > 1;  // don't highlight if there's only one strategy
```

### Why `higherIsBetter` Is Always True — Even for Drawdown

This seems wrong at first: max drawdown is usually reported as a negative number (e.g., -15.3%), so shouldn't lower (more negative) be worse? Yes — but `Math.max(-2, -20)` returns `-2`, which is the *less bad* drawdown. The `higherIsBetter: true` + `Math.max` combination naturally picks the better value because higher (closer to zero) drawdowns are better.

The alternative — `higherIsBetter: false` with `Math.min` — would require maintaining two code paths. Using `Math.max` uniformly keeps the highlight logic in a single line.

---

## Section: Overlaid Equity Curves with Normalization

The equity chart overlays multiple strategies on a single Lightweight Charts instance. But there's a problem: Strategy A might start with $10,000 capital and Strategy B with $50,000. If you plot raw dollar values, Strategy B's line will dwarf Strategy A's, making visual comparison meaningless.

### Normalization to Base 100

The solution is to normalize each series so the first data point equals 100:

```typescript
const startValue = s.data[0].value || 1;  // guard against zero
const normalizedData = s.data.map((d) => ({
  time: d.date as string,
  value: Number(((d.value / startValue) * 100).toFixed(4)),
}));
```

If Strategy A goes from $10,000 → $13,000 and Strategy B goes from $50,000 → $55,000, they'll display as 100 → 130 and 100 → 110 respectively. Now you can visually see that Strategy A outperformed.

The chart header communicates this: `"Normalized to 100 at start of period"`.

### Color Palette and Legend

The component exports a fixed 5-color palette:

```typescript
export const COMPARISON_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#dc2626", // red
  "#9333ea", // purple
  "#d97706", // amber
];
```

The Server Component assigns colors to strategies using modular indexing:

```typescript
const equitySeries = items.map((item, idx) => ({
  color: COMPARISON_COLORS[idx % COMPARISON_COLORS.length],
  // ...
}));
```

This guarantees colors cycle if a user compares more than 5 strategies. The legend renders below the chart title as colored rectangles with strategy names.

### Cleanup: The Stale Ref Bug

During the ESLint cleanup phase, we discovered a React Hook warning in the chart's cleanup function:

```typescript
// ❌ Before — ESLint warns: seriesRefsMap.current may be stale
return () => {
  ro.disconnect();
  chart.remove();
  seriesRefsMap.current.clear();
};
```

The problem: React's rules-of-hooks lint rule flags reading `.current` from a ref inside a cleanup function because the ref might point to a new value by the time the cleanup runs. The fix:

```typescript
// ✅ After — capture the current ref value before the cleanup closure
const currentSeriesRefs = seriesRefsMap.current;
return () => {
  ro.disconnect();
  chart.remove();
  chartRef.current = null;
  currentSeriesRefs.clear();
};
```

This is a general pattern: **whenever you access a ref in a useEffect cleanup, copy `.current` to a local variable inside the effect body, then use that variable in the cleanup.**

---

## Section: Testing the Comparison Components

### Testing Best-Value Highlighting

The metrics table test verifies that the cell with the best value gets a green CSS class:

```typescript
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
```

The test uses `className.match(/green/)` instead of checking for a specific class name. This is intentional — the exact Tailwind classes (`bg-green-50 dark:bg-green-950/30`) are implementation details that could change. The test cares about the *semantic behavior* (is the best cell highlighted?) not the specific utility classes.

### Testing Lightweight Charts (Mocked)

Lightweight Charts requires a real Canvas API, which jsdom doesn't provide. The test mocks the entire module:

```typescript
const mockSetData = vi.fn();
const mockAddSeries = vi.fn(() => ({ setData: mockSetData }));

vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => ({
    addSeries: mockAddSeries,
    timeScale: () => ({ fitContent: mockFitContent }),
    remove: mockRemove,
  })),
  LineSeries: "LineSeries",
  ColorType: { Solid: "Solid" },
}));
```

Then the normalization test inspects mock call arguments:

```typescript
it("normalises data to base 100 for each series", () => {
  render(<ComparisonEquityChart series={[seriesA]} />);
  const callArgs = mockSetData.mock.calls[0][0] as { value: number }[];
  expect(callArgs[0].value).toBeCloseTo(100, 1);
  expect(callArgs[1].value).toBeCloseTo(105, 1);  // 10500/10000 * 100
});
```

This is a powerful technique: you can't visually render a chart in jsdom, but you *can* verify the data pipeline by inspecting what data was passed to the chart library.

---

## Key Takeaway

> **Compare N items by normalizing them to a common baseline.** Whether it's equity curves normalized to 100 or metric cells highlighted by best-value, comparison features must strip away absolute differences and surface relative performance — that's what makes the visual useful.

---

**Next:** [Lesson 37 — Parameter Optimization: SSE Streaming and Adaptive Result Visualization](./37-parameter-optimization-sse-visualization.md)

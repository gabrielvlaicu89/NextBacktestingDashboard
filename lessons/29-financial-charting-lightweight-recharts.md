# Lesson 29 — Financial Charting with Lightweight Charts and Recharts

Displaying financial data visually is what separates a useful backtesting platform from a JSON viewer. This project uses **two** charting libraries — Lightweight Charts for time-series financial data and Recharts for statistical visualisations. This lesson explains why we need both, how each integrates with React, and the imperative-vs-declarative tension you'll face when mixing canvas-based and SVG-based charts.

---

## Section: Why Two Libraries Instead of One

Each library excels at a different type of chart:

| Capability | Lightweight Charts | Recharts |
|---|---|---|
| Architecture | HTML Canvas (imperative) | SVG (declarative JSX) |
| Best for | Time-series financial data | Statistical charts (bar, pie, scatter) |
| Time axis | Built-in financial time scale (skips weekends, handles gaps) | Generic axis (no financial awareness) |
| Crosshair | Built-in synchronized crosshair + tooltip | Manual tooltip via `<Tooltip>` component |
| Bundle size | ~45 KB gzipped | ~120 KB gzipped |
| React API | None — imperative `createChart()` | Full JSX component tree |

For equity curves and drawdown charts, Lightweight Charts is the clear winner: its financial time scale automatically handles market holidays and weekends without gaps. Recharts would show empty space for Saturdays and Sundays.

For the trade distribution histogram, Recharts is simpler — it's just bars with counts, no time axis needed. The JSX API (`<BarChart>`, `<Bar>`, `<Cell>`) maps directly to React's component model.

---

## Section: Lightweight Charts — The Imperative Pattern

Lightweight Charts doesn't have a React wrapper (officially). You create and destroy a `<canvas>` element imperatively inside a `useEffect`. This creates a pattern that every canvas-based library follows:

```
Mount             Effect runs        Unmount
  │                    │                │
  ▼                    ▼                ▼
ref div         createChart(div)   chart.remove()
created         addSeries()        resizeObserver.disconnect()
                setData()
                fitContent()
                observe(resize)
```

Here's the equity curve implementation:

```tsx
import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  LineSeries,
  ColorType,
} from "lightweight-charts";

export function EquityCurveChart({ data, height = 350 }: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    // 1. CREATE — imperative chart creation
    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#888",
      },
      // ...
    });
    chartRef.current = chart;

    // 2. ADD SERIES — portfolio line (blue, solid)
    const portfolioSeries = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      title: "Portfolio",
    });

    // 3. ADD SERIES — benchmark line (gray, dashed)
    const benchmarkSeries = chart.addSeries(LineSeries, {
      color: "#9ca3af",
      lineWidth: 1,
      lineStyle: 2, // Dashed
      title: "Benchmark",
    });

    // 4. SET DATA — transform our shape to chart's shape
    portfolioSeries.setData(data.map((d) => ({
      time: d.date as string,
      value: d.value,
    })));
    benchmarkSeries.setData(data.map((d) => ({
      time: d.date as string,
      value: d.benchmark_value,
    })));

    // 5. FIT — zoom to show all data
    chart.timeScale().fitContent();

    // 6. RESPONSIVE — observe container width changes
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // 7. CLEANUP — destroy everything on unmount or data change
    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height]);

  return <div ref={containerRef} data-testid="equity-curve-container" />;
}
```

### Key decisions in this pattern:

**The `as string` cast on `time`:** Lightweight Charts expects `time` to be a string in `"YYYY-MM-DD"` format or a Unix timestamp. Our data already uses ISO date strings, but TypeScript's `Time` type is a union. The cast satisfies the compiler without a runtime conversion.

**Using `useRef` for chart and series:** We store the chart instance in a ref, not state, because we never want changing the chart to trigger a re-render. The chart manages its own canvas — React shouldn't know about its internal state.

**`ResizeObserver` instead of `window.resize`:** `ResizeObserver` watches the container element specifically, not the entire window. This is more precise — the chart resizes correctly even if only the sidebar opens/closes, not just on window resize.

**The `transparent` background:** Setting the chart background to transparent lets the parent `<Card>` component's background show through. This keeps the chart visually consistent with the design system — in dark mode, the card is dark; in light mode, it's white. The chart inherits both without any theme detection code.

---

## Section: The Drawdown Chart — AreaSeries Variant

The drawdown chart follows the identical pattern but uses `AreaSeries` instead of `LineSeries`:

```tsx
import { AreaSeries } from "lightweight-charts";

const series = chart.addSeries(AreaSeries, {
  lineColor: "#ef4444",
  lineWidth: 1,
  topColor: "rgba(239, 68, 68, 0.4)",   // Red fill at the line
  bottomColor: "rgba(239, 68, 68, 0.05)", // Fade to near-transparent
  title: "Drawdown %",
});
```

`AreaSeries` fills the region between the line and the bottom of the chart. Since drawdown values are always negative (or zero), the red fill naturally appears below the zero line, creating the characteristic "drawdown underwater" visual that traders expect.

---

## Section: What Broke — `LineSeries` and `AreaSeries` Cannot Be Used as Values

The first version of the equity curve chart used this import:

```tsx
import type {
  createChart, IChartApi, ISeriesApi, LineSeries, ColorType,
} from "lightweight-charts";
```

TypeScript threw:

```
'LineSeries' cannot be used as a value because it was imported using 'import type'.
```

**The root cause:** `import type` tells TypeScript to erase the import at compile time — it only keeps type information. But `LineSeries` in Lightweight Charts v5 is a **value export** (it's an alias for the `lineSeries` constructor function). We pass it as the first argument to `chart.addSeries(LineSeries, {...})`, which is a runtime call.

**The fix:** Import `LineSeries` and `AreaSeries` as regular value imports:

```tsx
import {
  createChart,
  type IChartApi,     // ← type-only (interface)
  type ISeriesApi,    // ← type-only (interface)
  LineSeries,         // ← value export (constructor)
  ColorType,          // ← value export (enum)
} from "lightweight-charts";
```

In the drawdown chart, `AreaSeries` had the same problem and was separated into its own value import line:

```tsx
import { AreaSeries } from "lightweight-charts";
```

**The general lesson:** When a library exports both types and runtime values from the same module, you must be careful about `import type`. If you're passing something as a **function argument**, it's a value and cannot use `import type`. TypeScript's `--verbatimModuleSyntax` flag (which Next.js enables) enforces this strictly.

---

## Section: Recharts — The Declarative Pattern

Recharts takes the opposite approach to Lightweight Charts. Everything is JSX:

```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={buckets} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
    <XAxis dataKey="range" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" />
    <YAxis allowDecimals={false} label={{ value: "Trades", angle: -90 }} />
    <Tooltip formatter={(value: number) => [`${value} trades`, "Count"]} />
    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
      {buckets.map((bucket, idx) => (
        <Cell key={idx} fill={bucket.isProfit ? "#22c55e" : "#ef4444"} />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

### The `bucketTrades` utility

Before rendering, we need to transform a flat list of trades into histogram buckets. This is a pure function, separate from the component:

```tsx
function bucketTrades(trades: TradeResult[]): Bucket[] {
  if (trades.length === 0) return [];

  const step = 5; // Each bucket spans 5%
  const min = Math.floor(Math.min(...trades.map((t) => t.pnl_pct)) / step) * step;
  const max = Math.ceil(Math.max(...trades.map((t) => t.pnl_pct)) / step) * step;

  const buckets: Bucket[] = [];
  for (let low = min; low < max; low += step) {
    const high = low + step;
    const count = trades.filter((t) => t.pnl_pct >= low && t.pnl_pct < high).length;
    buckets.push({
      range: `${low}% to ${high}%`,
      count,
      isProfit: low >= 0,
      midpoint: low + step / 2,
    });
  }
  return buckets;
}
```

The `isProfit` flag on each bucket drives the `<Cell>` fill color — green for profit buckets, red for loss.

### Per-bar coloring with `<Cell>`

Recharts doesn't support per-bar colors out of the box on `<Bar>`. You achieve it by mapping `<Cell>` children inside the `<Bar>`:

```tsx
<Bar dataKey="count" radius={[4, 4, 0, 0]}>
  {buckets.map((bucket, idx) => (
    <Cell key={idx} fill={bucket.isProfit ? "#22c55e" : "#ef4444"} />
  ))}
</Bar>
```

Each `<Cell>` overrides the fill color for its corresponding data point. This pattern is slightly awkward — you're rendering children that map 1:1 to data points — but it's the official Recharts way.

---

## Section: The Monthly Returns Heatmap — No Library Needed

Not every visualisation requires a charting library. The monthly returns heatmap is a plain HTML `<table>` with inline background colors:

```tsx
function getCellColor(value: number): string {
  const absVal = Math.min(Math.abs(value), 20); // cap at 20%
  const intensity = absVal / 20;

  if (value > 0) {
    const alpha = 0.15 + intensity * 0.6;
    return `rgba(34, 197, 94, ${alpha})`; // Green
  } else if (value < 0) {
    const alpha = 0.15 + intensity * 0.6;
    return `rgba(239, 68, 68, ${alpha})`; // Red
  }
  return "transparent";
}
```

Why inline `rgba()` instead of Tailwind classes like `bg-green-500/40`?

**Tailwind classes are discrete steps.** You'd need `bg-green-500/10`, `bg-green-500/20`, ..., `bg-green-500/75` — each as a separate class name. With 12 months × multiple years, each cell has a different intensity. Inline styles give us a **continuous** gradient from barely visible to fully saturated.

The heatmap uses a `Map<string, number>` for O(1) cell lookup:

```tsx
const grid = new Map<string, number>();
for (const d of data) {
  grid.set(`${d.year}-${d.month}`, d.return_pct);
}

// Later, in the render loop:
const value = grid.get(`${year}-${monthIdx + 1}`);
```

This avoids nested `.find()` calls inside the render loop, which would be O(n) per cell × 12 months × n years.

---

## Key Takeaway

> Use the right tool for each chart type: Lightweight Charts for time-series financial data (it understands trading calendars), Recharts for statistical charts (declarative JSX), and plain HTML tables when the visualisation is just a colored grid. Don't force one library to do everything.

---

**Next:** [Lesson 30 — Sortable Data Tables with TanStack Table](./30-tanstack-table-data-tables.md)

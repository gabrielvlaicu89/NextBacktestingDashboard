# Lesson 37 — Parameter Optimization: SSE Streaming and Adaptive Result Visualization

Grid-search parameter optimization is computationally expensive — hundreds of parameter combinations, each running a full backtest. Waiting for the entire search to finish before showing anything is a poor user experience. This lesson covers how we built a streaming optimization pipeline that shows progress in real time, then renders results in one of three visualization formats based on how many parameters were swept. Along the way, we'll examine the Fetch-based SSE reader and the server-client page split.

---

## Section: The Server/Client Split — Why Optimization Needs Both

The optimize page uses the same Next.js pattern as other pages: a **Server Component** fetches the strategy data, then a **Client Component** handles all the interactive behavior (form submission, SSE streaming, result rendering).

```
┌────────────────────────────────────────────────────────────┐
│  /dashboard/optimize/[id]/page.tsx  (Server Component)     │
│  ├── getStrategy(id)  → StrategyWithRuns                   │
│  ├── getCatalogItem(strategy.type) → StrategyCatalogItem   │
│  └──► <OptimizeClient strategy={…} catalog={…} />          │
│                                                            │
│  OptimizeClient  (Client Component — orchestrator)         │
│  ├── OptimizeConfigForm  — grid-search range inputs        │
│  ├── OptimizeProgress    — progress bar + message          │
│  ├── OptimizeResults     — chart / heatmap / table         │
│  └── useOptimizeStream() — Fetch + ReadableStream hook     │
└────────────────────────────────────────────────────────────┘
```

**Why not make the page itself a Client Component?** Because `getStrategy(id)` calls Prisma directly. Prisma can only run on the server — it talks to a database via a connection string that must never reach the browser. By keeping the page as a Server Component, we guarantee the database query runs server-side. The `OptimizeClient` receives only the serialized result.

### The Catalog Lookup

The Server Component also resolves the strategy's catalog item:

```typescript
const catalog = getCatalogItem(strategy.type);
if (!catalog) notFound();
```

`getCatalogItem` returns the `StrategyCatalogItem` for a strategy type (e.g., MA_CROSSOVER), which includes the parameter definitions — their types, labels, min/max, step values. This catalog drives the dynamic form. Without it, the form wouldn't know which parameters are numeric (sweepable) and which are categorical (fixed).

---

## Section: The Config Form — Catalog-Driven Range Inputs

The `OptimizeConfigForm` component generates its UI entirely from catalog metadata. It splits parameters into two categories:

| Category | Param type | UI treatment | In submission |
|---|---|---|---|
| **Numeric** | `type: "number"` | Min / Max / Step inputs | Goes into `param_ranges` |
| **Fixed** | `type: "select"`, `"ticker"` | Read-only display | Goes into `fixed_parameters` |

```typescript
const numericParams = catalog.params.filter((p) => p.type === "number");
const fixedParams = catalog.params.filter((p) => p.type !== "number");
```

### Intelligent Defaults

For each numeric parameter, the form sets initial range values based on the strategy's current value:

```typescript
const currentVal =
  typeof strategy.parameters[p.key] === "number"
    ? (strategy.parameters[p.key] as number)
    : (p.default as number | undefined) ?? 0;
const step = p.step ?? 1;
// Default range: ±2 steps around the current value
init[p.key] = {
  min: String(Math.max(p.min ?? 0, currentVal - step * 2)),
  max: String(currentVal + step * 2),
  step: String(step),
};
```

If a user's MA Crossover strategy has `fast_period = 10` with `step = 1`, the form pre-fills `min=8, max=12, step=1`. This is useful because the most interesting optimization region is usually near the current configuration.

### The Submission Shape — `OptimizeConfig`

When the form is submitted, it builds a strictly-typed config object:

```typescript
export interface OptimizeConfig {
  strategy_type: string;
  ticker: string;
  date_from: string;
  date_to: string;
  benchmark: string;
  risk_settings: RiskSettings;
  fixed_parameters: Record<string, unknown>;
  param_ranges: Record<string, ParamRange>;
  optimize_for: string;
}
```

This mirrors the FastAPI backend's expected payload. The `param_ranges` field contains only the numeric parameters to sweep, while `fixed_parameters` contains everything else. The backend's grid search optimizer will call `itertools.product` over the ranges and hold the fixed parameters constant.

---

## Section: SSE Streaming via Fetch + ReadableStream

Previous phases used `EventSource` for SSE (the backtest progress stream). The optimization hook uses a different approach — `fetch()` with a `ReadableStream` reader. Why?

| Feature | EventSource | Fetch + ReadableStream |
|---|---|---|
| HTTP method | GET only | Any (GET, POST, etc.) |
| Request body | Not supported | Full JSON body |
| Headers | Limited control | Full control |
| Auto-reconnect | Built-in | Manual |
| Browser support | Universal | Universal (modern) |

The optimization request **must be a POST** because it sends a large JSON config body. `EventSource` only supports GET requests, so it's not an option.

### The `useOptimizeStream` Hook

```typescript
export function useOptimizeStream(): UseOptimizeStreamReturn {
  const [status, setStatus] = useState<OptimizeStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OptimizeResultEntry[] | null>(null);
  // ...

  const startOptimize = useCallback(async (config: OptimizeConfig) => {
    abort();  // cancel any in-flight request

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
      signal: controller.signal,
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";  // keep incomplete block in buffer

      for (const block of blocks) {
        if (!trimmed.startsWith("data: ")) continue;
        const data = JSON.parse(trimmed.slice(6));
        // Route by event type...
      }
    }
  }, [abort]);
```

### The SSE Parsing Algorithm

SSE events are delimited by double newlines (`\n\n`). Each event has this format:

```
data: {"type": "progress", "percent": 42, "message": "Testing window=20"}\n\n
```

The reader receives data in arbitrary-sized chunks — a single `read()` call might contain half an event, two full events, or one event plus half of the next. The buffer-and-split approach handles this:

1. Append new bytes to the buffer
2. Split on `\n\n` — complete events are in all but the last segment
3. The last segment (which may be incomplete) stays in the buffer
4. Parse each complete block as JSON

### Abort Handling

The hook stores an `AbortController` ref so the user can cancel mid-run:

```typescript
const abort = useCallback(() => {
  abortControllerRef.current?.abort();
  abortControllerRef.current = null;
}, []);
```

When `abort()` is called, the fetch throws an `AbortError`. The hook catches this specifically and transitions to `idle` (not `error`):

```typescript
catch (err) {
  if (err instanceof Error && err.name === "AbortError") {
    setStatus("idle");
    return;   // silent cancel
  }
  setError(msg);
  setStatus("error");
}
```

This distinction matters: cancellation is an intentional user action, not a failure. The UI should return to the form state, not show an error banner.

---

## Section: The Orchestrator — `OptimizeClient`

The `OptimizeClient` component ties everything together with a state machine driven by the hook's `status`:

```
idle → [user submits] → running → [stream completes] → completed
                           ↓                               ↓
                        [error]                    [user clicks result]
                           ↓                               ↓
                       Show Alert              prefillFromStrategy → navigate
```

The key design decision: **always show the config form**. Even while the optimization is running, the form stays visible (but disabled). This lets users review their config while waiting and immediately tweak and re-run once results arrive.

### The `onRunConfig` Flow

When a user clicks a result (a chart point, heatmap cell, or table row), the component pre-fills the Redux strategy builder and navigates to `/dashboard/new`:

```typescript
const handleRunConfig = useCallback(
  (params: Record<string, unknown>) => {
    dispatch(
      prefillFromStrategy({
        ticker: strategy.ticker,
        dateFrom: strategy.dateFrom,
        dateTo: strategy.dateTo,
        strategyType: strategy.type as StrategyType,
        parameters: params,           // ← the winning combination
        riskSettings: strategy.riskSettings,
        benchmark: strategy.benchmark,
        name: strategy.name,
        tags: strategy.tags,
      }),
    );
    router.push("/dashboard/new");
  },
  [dispatch, router, strategy],
);
```

This reuses the `prefillFromStrategy` Redux action from Phase 8's duplicate flow. The optimization page doesn't create a new backtest — it just finds the best parameters and lets the user launch a full backtest from the strategy builder.

---

## Section: Adaptive Visualization — One Component, Three Renderers

The `OptimizeResults` component dynamically selects a visualization based on the number of swept parameters:

| Swept params | Visualization | Rationale |
|---|---|---|
| 1 | Recharts `LineChart` | X = param value, Y = metric — natural 1D relationship |
| 2 | CSS heatmap grid | X × Y grid with colour intensity — shows interaction effects |
| 3+ | Sortable table | Too many dimensions for a chart — let the user sort and filter |

```typescript
{paramKeys.length === 1 && <OneParamChart ... />}
{paramKeys.length === 2 && <TwoParamHeatmap ... />}
{paramKeys.length >= 3 && <MultiParamTable ... />}
```

### The Heatmap: A Pure CSS Grid

The 2-parameter heatmap uses a plain `<table>` with inline background colors — no chart library needed. The colour function maps normalized metric values to an RGB gradient:

```typescript
function heatColour(intensity: number): string {
  const r = Math.round(30 + (1 - intensity) * 200);   // blue → low
  const g = Math.round(100 + intensity * 110);          // green → high
  const b = Math.round(200 - intensity * 170);          // fades out
  return `rgb(${r},${g},${b})`;
}
```

A value of `intensity = 0` (worst metric) produces a cool blue; `intensity = 1` (best metric) produces a bright green. The normalization function maps the actual metric range to [0, 1]:

```typescript
function normalise(value: number, min: number, max: number): number {
  if (max === min) return 0.5;  // all same value → neutral
  return (value - min) / (max - min);
}
```

### The Table: Client-Side Sorting

For 3+ parameters, the `MultiParamTable` sub-component implements sorting with `useState` and `useMemo`:

```typescript
const [sortKey, setSortKey] = useState<string>("metric");
const [sortAsc, setSortAsc] = useState(false);

const sorted = useMemo(() => {
  return [...results].sort((a, b) => {
    const av = sortKey === "metric" ? (a.metric ?? -Infinity) : (a.params[sortKey] ?? 0);
    const bv = sortKey === "metric" ? (b.metric ?? -Infinity) : (b.params[sortKey] ?? 0);
    return sortAsc ? av - bv : bv - av;
  });
}, [results, sortKey, sortAsc]);
```

Note the `null` handling: `metric` can be `null` (a failed backtest for that param combo). Null metrics sort to the bottom by defaulting to `-Infinity`.

---

## Section: Testing the Optimization Pipeline

### Testing the Hook with Mock Fetch

The `useOptimizeStream` test replaces `global.fetch` with a vi mock that returns a `ReadableStream`:

```typescript
function makeSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const sseText = events.map((e) => `data: ${e}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });
}

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  body: makeSseStream([completeEvent]),
});
```

This approach is cleaner than mocking `EventSource` because `ReadableStream` is a standard Web API that jsdom supports. The test can verify the entire status progression:

```typescript
it("transitions status to running then completed", async () => {
  const { result } = renderHook(() => useOptimizeStream());

  act(() => { void result.current.startOptimize(makeConfig()); });
  expect(result.current.status).toBe("running");

  await waitFor(() => expect(result.current.status).toBe("completed"));
});
```

### Testing Adaptive Rendering

The `OptimizeResults` test suite uses three different fixture datasets:

```typescript
const oneParamResults   = [{ params: { window: 10 }, metric: 0.8 }, ...];
const twoParamResults   = [{ params: { fast: 5, slow: 20 }, metric: 1.1 }, ...];
const threeParamResults = [{ params: { a: 1, b: 2, c: 3 }, metric: 0.5 }, ...];
```

Each test passes different `paramKeys` to verify the correct visualization renders:

```typescript
it("renders a line chart for 1 swept param", () => {
  render(<OptimizeResults ... paramKeys={["window"]} />);
  expect(screen.getByTestId("optimize-results-chart")).toBeInTheDocument();
});

it("renders a heatmap for 2 swept params", () => {
  render(<OptimizeResults ... paramKeys={["fast", "slow"]} />);
  expect(screen.getByTestId("optimize-results-heatmap")).toBeInTheDocument();
});

it("renders a sortable table for 3 swept params", () => {
  render(<OptimizeResults ... paramKeys={["a", "b", "c"]} />);
  expect(screen.getByTestId("optimize-results-table")).toBeInTheDocument();
});
```

Each test also verifies the **negative case** — that the other renderers are absent:

```typescript
it("does not render heatmap or table for 1 swept param", () => {
  render(<OptimizeResults ... paramKeys={["window"]} />);
  expect(screen.queryByTestId("optimize-results-heatmap")).not.toBeInTheDocument();
  expect(screen.queryByTestId("optimize-results-table")).not.toBeInTheDocument();
});
```

### Mocking Recharts

The `OptimizeResults` tests need to render `LineChart` from Recharts, but Recharts requires a DOM with SVG support. The mock replaces every Recharts component with a plain `<div>`:

```typescript
vi.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }) =>
      React.createElement("div", { "data-testid": "responsive-container" }, children),
    LineChart: ({ children, onClick, data }) =>
      React.createElement("div", {
        "data-testid": "line-chart",
        onClick: () => onClick?.({ activePayload: data ? [{ payload: data[0] }] : [] }),
      }, children),
    Line: () => React.createElement("div", { "data-testid": "recharts-line" }),
    // ...
  };
});
```

The `LineChart` mock wires up `onClick` to simulate what Recharts does when a user clicks a data point: it calls `onClick` with an `activePayload` containing the clicked point's data. This lets us test the "click chart point → fire `onRunConfig`" flow without a real SVG renderer.

---

## Key Takeaway

> **Choose visualization by data shape, not user preference.** When your component receives results, count the dimensions and pick the optimal renderer automatically — a line chart for 1D, a heatmap for 2D, a table for 3D+. This eliminates configuration burden and always shows the most useful view for the data at hand.

---

**Next:** [Lesson 38 — Fixing TypeScript and ESLint Errors Across a Growing Codebase](./38-fixing-typescript-eslint-errors.md)

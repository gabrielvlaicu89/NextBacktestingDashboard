# Lesson 28 — Results Dashboard: Orchestrating Server Data and Client State

A results dashboard is fundamentally different from the pages we've built so far. The Strategy Builder writes **to** Redux; the Results Dashboard reads **from** two competing sources — a server-loaded historical run and a live Redux stream. This lesson covers the orchestration pattern that merges both, the state machine that drives it, and the Page → Client Component data handoff that makes it all work inside the App Router.

---

## Section: The Two Data Sources Problem

When the user navigates to `/dashboard/results/[id]`, the page displays a **past** run already stored in the database. When they click "Run Backtest" on the Strategy Builder and are redirected to `/dashboard/results`, the page displays a **live** run whose data arrives via SSE and accumulates in Redux.

Both scenarios render identical UI — performance cards, charts, trade log — but the data arrives from completely different origins:

| Source | Route | Data Origin | Lifecycle |
|---|---|---|---|
| Server (Prisma) | `/results/[id]` | `getStrategy(id)` → DB record | Available immediately at render |
| Redux (live) | `/results` | `useBacktestStream` → SSE → Redux | Builds up during backtest execution |

A naive approach would be building two separate pages. The orchestration pattern avoids this by creating a single `ResultsDashboard` client component that accepts **optional** server props and falls back to Redux.

---

## Section: The Server Component → Client Component Handoff

The dynamic route page (`app/dashboard/results/[id]/page.tsx`) is a **Server Component**. It fetches the strategy and its runs on the server, extracts the latest completed run's results, and passes them as serialised props:

```tsx
// app/dashboard/results/[id]/page.tsx — Server Component
import { notFound } from "next/navigation";
import { getStrategy } from "@/lib/actions/strategies";
import { ResultsDashboard } from "@/components/results/results-dashboard";
import type { BacktestResponse } from "@/lib/types";

interface ResultsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params;

  let strategy;
  try {
    strategy = await getStrategy(id);
  } catch {
    notFound();
  }

  if (!strategy) {
    notFound();
  }

  // Find the latest completed run's results
  const latestRun = strategy.runs.find((r) => r.status === "COMPLETED");
  const savedResults: BacktestResponse | null = latestRun?.results ?? null;

  return (
    <div className="p-6">
      <ResultsDashboard
        strategy={strategy}
        savedResults={savedResults}
        strategyId={strategy.id}
      />
    </div>
  );
}
```

Two things to notice:

1. **`params` is a `Promise` in Next.js 15+.** Dynamic route params are now async. You must `await params` before accessing `id`. Forgetting this produces a confusing error about reading `.id` on a Promise object.

2. **`notFound()` for missing strategies.** This is a Next.js utility that immediately renders the nearest `not-found.tsx` boundary. It's cleaner than returning a 404 status code manually.

The live results page is much simpler — it renders `ResultsDashboard` with **no** server props, relying entirely on Redux:

```tsx
// app/dashboard/results/page.tsx
import { ResultsDashboard } from "@/components/results/results-dashboard";

export default function LiveResultsPage() {
  return (
    <div className="p-6">
      <ResultsDashboard />
    </div>
  );
}
```

---

## Section: The Client Component State Machine

`ResultsDashboard` is a `"use client"` component that reads from Redux and merges with any server-provided props:

```tsx
const results: BacktestResponse | null = savedResults ?? reduxResults;
const effectiveStrategyId = strategyId ?? reduxStrategyId ?? undefined;
```

The **nullish coalescing chain** `savedResults ?? reduxResults` is the key: server data takes priority. If you load `/results/[id]`, `savedResults` is always populated and Redux state doesn't matter. If you load `/results` during a live run, `savedResults` is `undefined` and Redux fills in.

The component renders one of four states:

```
┌─────────────────────────────────────────────────┐
│  backtestStatus === "running"                   │
│  ───────────────────────────                    │
│  → BacktestProgressBar (progress, message)      │
├─────────────────────────────────────────────────┤
│  backtestStatus === "failed" && !results        │
│  ───────────────────────────────────            │
│  → Error card (AlertCircle + reduxError)        │
├─────────────────────────────────────────────────┤
│  !results (idle, no data)                       │
│  ────────────────────────                       │
│  → Empty state placeholder                      │
├─────────────────────────────────────────────────┤
│  results available                              │
│  ──────────────────                             │
│  → Full dashboard:                              │
│    Header (name + metadata)                     │
│    SaveExperimentDialog                         │
│    PerformanceCards                             │
│    Tabs (equity / drawdown / monthly / dist.)   │
│    TradeLogTable                                │
└─────────────────────────────────────────────────┘
```

This sequential guard pattern (check running → check failed → check empty → render full) keeps the component readable. Each guard returns early, so the main render block at the bottom only executes when there are actual results.

---

## Section: The Loading / Error Boundary Triad

Every Next.js App Router route should provide three files:

| File | Purpose | Type |
|---|---|---|
| `page.tsx` | Main data fetch + render | Server Component |
| `loading.tsx` | Shown while `page.tsx`'s async work runs | Server Component |
| `error.tsx` | Shown when `page.tsx` throws | Client Component (`"use client"`) |

For the results page:

**`loading.tsx`** renders skeleton cards matching the performance-cards grid layout:

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {Array.from({ length: 7 }).map((_, i) => (
    <Card key={i}>
      <CardHeader className="pb-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  ))}
</div>
```

Notice the skeleton matches the real layout: same grid columns, same card structure, same spacing. This prevents layout shift when the real data loads.

**`error.tsx`** must be a client component (next.js requirement) and receives `error` + `reset` props from the framework:

```tsx
export default function ResultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // ...
  <Button variant="outline" onClick={reset}>Try again</Button>
```

The `reset` function re-renders the route segment, giving the server fetch another chance. The `digest` property is a hash Next.js attaches for server-side errors, keeping the actual error message private in production.

---

## Section: Data-Driven Metric Cards with Color Semantics

The `PerformanceCards` component uses a data-driven `METRIC_DEFS` array instead of hardcoding 7 separate card components:

```tsx
interface MetricDef {
  key: keyof PerformanceMetrics;
  label: string;
  format: (v: number) => string;
  colorize: boolean;
  invertColor?: boolean;
}

const METRIC_DEFS: MetricDef[] = [
  {
    key: "total_return_pct",
    label: "Total Return",
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
    colorize: true,
  },
  {
    key: "max_drawdown_pct",
    label: "Max Drawdown",
    format: (v) => `${v.toFixed(2)}%`,
    colorize: true,
    invertColor: true, // ← negative is good for drawdown
  },
  // ... 5 more
];
```

This pattern gives us:

1. **Consistent formatting** — each metric knows how to render itself (percentage vs decimal).
2. **Color inversion** — Max Drawdown is typically negative (-12.3%), but that's a *good* thing. The `invertColor` flag flips the green/red logic so negative = green.
3. **Easy extension** — adding a new metric is one object in the array, not a new JSX block.

The color function handles the inversion:

```tsx
function getColorClass(value: number, invert = false): string {
  const isPositive = invert ? value <= 0 : value > 0;
  const isNeutral = value === 0;
  if (isNeutral) return "text-muted-foreground";
  return isPositive
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";
}
```

---

## Section: Why Tabs Instead of Stacked Charts

The results dashboard uses shadcn `Tabs` to switch between four chart views (equity, drawdown, monthly heatmap, distribution). The alternative was to stack all charts vertically on a single scrollable page.

**Why tabs won:**

| Consideration | Stacked | Tabs |
|---|---|---|
| Initial render cost | All charts render at once | Only active chart renders |
| Scroll fatigue | 4 heavy charts = long scroll | One chart visible at a time |
| Focus | User sees everything, focuses on nothing | Clear focus on one visualisation |
| DOM nodes | High (especially with Lightweight Charts canvases) | Low (only one chart's canvas exists) |

shadcn's `TabsContent` unmounts inactive tabs by default. This means Lightweight Charts canvases are created and destroyed as tabs switch, which is desirable — each chart re-syncs with current data on mount.

---

## Section: What Broke — TypedUseSelectorHook and the Phantom Error

When `ResultsDashboard` was first written, all six `useSelector` calls showed an error in the VS Code language server:

```
's.backtest' is of type 'unknown'
```

**The symptom:** `useSelector((s) => s.backtest.status)` — TypeScript couldn't infer that `s` was `RootState`.

**What was tried first:** The project's `store/store.ts` exports a typed `useAppSelector` via `useSelector.withTypes<RootState>()`. This works everywhere else in the project. But in `results-dashboard.tsx`, the language server refused to resolve the type.

**What was tried second:** Importing `RootState` directly and annotating the selector: `useSelector((s: RootState) => s.backtest.status)`. Same phantom error.

**The root cause:** This was a VS Code TypeScript language server caching issue — not a real compilation error. Running `npx tsc --noEmit` reported **zero errors** from the file.

**The fix:** Use a local `TypedUseSelectorHook` binding:

```tsx
import { useSelector, type TypedUseSelectorHook } from "react-redux";
import type { RootState } from "@/store/store";

const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

This essentially does the same thing as `useSelector.withTypes<RootState>()` but as a local variable assignment. The language server accepted this pattern.

**The lesson:** When you encounter TypeScript errors that `tsc` doesn't see, the issue is usually with the language server cache. Before restructuring your code, run `npx tsc --noEmit` to verify whether the error is real. If it's not, try restarting the TypeScript server (`Ctrl+Shift+P` → "TypeScript: Restart TS Server") or, as a last resort, use an alternate type binding pattern.

---

## Key Takeaway

> A results dashboard that serves both live-streaming and historical data shouldn't be two separate pages. Use the **nullish coalescing handoff** pattern: the server component passes pre-loaded data as props, and the client component falls back to Redux when those props are absent — `savedResults ?? reduxResults`.

---

**Next:** [Lesson 29 — Financial Charting with Lightweight Charts and Recharts](./29-financial-charting-lightweight-recharts.md)

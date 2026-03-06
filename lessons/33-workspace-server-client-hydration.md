# Lesson 33 — Workspace Dashboard Architecture: Server Fetch, Client Hydration & Derived State

The Workspace Dashboard is the first page users see after login. Its goal is simple: show every saved strategy with key metrics, and let users sort, filter, and take actions on them. Getting there, however, requires a careful architectural decision — *where* does data fetching happen, *where* does interactive state live, and *how* do we bridge the two? This lesson covers the Server Component → Client Component handoff, Redux hydration, and `useMemo`-based derived state.

---

## Section: The Problem — Two Worlds That Need to Talk

Next.js App Router divides components into two universes:

| Property | Server Component | Client Component (`"use client"`) |
|---|---|---|
| Runs where? | Node.js process at request time | Browser after hydration |
| Can call Prisma / DB? | Yes | No |
| Can use hooks (useState, useEffect)? | No | Yes |
| Can dispatch Redux actions? | No | Yes |
| Output | Pre-rendered HTML (fast first paint) | Interactive DOM |

The Workspace page needs **both**: a database query for strategy data (server) and interactive sort/filter controls (client). The question is how to connect them.

### The alternatives we considered

1. **Fetch entirely on the client** — render a loading spinner, call an API route from `useEffect`, populate Redux. This works but delays data visibility (spinner on every page visit) and wastes the server-rendering capability that Next.js provides for free.

2. **Fetch entirely on the server with no client state** — Server Component fetches, renders cards directly. Works for static display, but every sort/filter change would require a full round-trip (server re-render or URL param change). Sluggish UX.

3. **Hybrid: server fetch → client hydration** ✅ — Server Component fetches once, passes data as props to a Client Component, which hydrates Redux. All subsequent sort/filter operations are instant (client-side).

We chose option 3.

---

## Section: The Implementation — Three Layers

### Layer 1: Server Component (`app/dashboard/page.tsx`)

```tsx
// app/dashboard/page.tsx — Server Component (no "use client" directive)
import { getServerSession } from "@/lib/auth";
import { getStrategies } from "@/lib/actions/strategies";
import { WorkspaceGrid } from "@/components/workspace/workspace-grid";

export default async function DashboardPage() {
  const session = await getServerSession();

  let strategies;
  try {
    strategies = await getStrategies();
  } catch {
    strategies = [];  // Graceful degradation — empty workspace instead of crash
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {session?.user?.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your workspace is ready. Create a new backtest or review your
          saved strategies.
        </p>
      </div>
      <WorkspaceGrid initialStrategies={strategies} />
    </div>
  );
}
```

Key decisions:
- **`getStrategies()`** is a server action that calls Prisma directly — no HTTP round-trip needed.
- **`try/catch` with `strategies = []`** — if the database is unreachable, the page still renders with an empty workspace rather than an error boundary. The user sees "No strategies found" instead of a cryptic error page.
- **Session data is used for the greeting** — `getServerSession()` runs on the server, reading the session cookie directly (no client-side fetch).

### Layer 2: Client Component — Redux Hydration (`workspace-grid.tsx`)

```tsx
"use client";

import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setStrategies } from "@/store/slices/workspaceSlice";
import type { StrategyWithRuns } from "@/lib/types";
import type { RootState } from "@/store/store";

interface WorkspaceGridProps {
  initialStrategies: StrategyWithRuns[];
}

export function WorkspaceGrid({ initialStrategies }: WorkspaceGridProps) {
  const dispatch = useDispatch();
  const { strategies, sortBy, sortDirection, filterType, filterTags } =
    useSelector((state: RootState) => state.workspace);

  // ← The bridge: server data enters Redux here
  useEffect(() => {
    dispatch(setStrategies(initialStrategies));
  }, [dispatch, initialStrategies]);

  // ... sorting/filtering/rendering below
}
```

The `useEffect` runs once after the first render. At that point `strategies` in Redux is `[]` (the initial state), so the first frame briefly has no data. In practice this is imperceptible because Next.js pre-renders the HTML on the server — the user never sees a blank screen.

**Why not pass `initialStrategies` directly to the card grid?** Because other actions (Delete, Duplicate) modify the list. If we only used props, we'd have no way to remove a card without re-fetching from the server. Redux gives us a mutable client-side copy that stays in sync with user actions.

### Layer 3: Derived State with `useMemo`

```tsx
const displayStrategies = useMemo(() => {
  let result = [...strategies];

  // Filter by strategy type
  if (filterType) {
    result = result.filter((s) => s.type === filterType);
  }

  // Filter by tags (AND logic — strategy must have ALL selected tags)
  if (filterTags.length > 0) {
    result = result.filter((s) =>
      filterTags.every((tag) => s.tags.includes(tag)),
    );
  }

  // Sort
  result.sort((a, b) => {
    let cmp = 0;

    if (sortBy === "createdAt") {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortBy === "sharpe") {
      const aMetrics = a.runs.find((r) => r.status === "COMPLETED")
        ?.results?.metrics;
      const bMetrics = b.runs.find((r) => r.status === "COMPLETED")
        ?.results?.metrics;
      cmp = (aMetrics?.sharpe_ratio ?? -Infinity)
          - (bMetrics?.sharpe_ratio ?? -Infinity);
    } else if (sortBy === "return") {
      const aMetrics = a.runs.find((r) => r.status === "COMPLETED")
        ?.results?.metrics;
      const bMetrics = b.runs.find((r) => r.status === "COMPLETED")
        ?.results?.metrics;
      cmp = (aMetrics?.total_return_pct ?? -Infinity)
          - (bMetrics?.total_return_pct ?? -Infinity);
    }

    return sortDirection === "asc" ? cmp : -cmp;
  });

  return result;
}, [strategies, sortBy, sortDirection, filterType, filterTags]);
```

This `useMemo` block is the heart of the UX. Every time the user changes a Select dropdown (sort field, direction, or filter type), Redux state updates, triggering a re-render. The `useMemo` re-computes the derived list — typically sub-millisecond for hundreds of strategies — and React diffs only the card order/visibility.

**Why `-Infinity` as the fallback?** A strategy without a completed run has no Sharpe ratio or return value. Using `-Infinity` ensures these strategies sort to the **bottom** in descending order (the default), rather than breaking the comparison with `NaN` or `undefined`.

---

## Section: The Data Flow Diagram

```
┌──────────────────────────────────────────────────────┐
│                   SERVER (Node.js)                    │
│                                                      │
│  DashboardPage (Server Component)                    │
│    │                                                 │
│    ├─► getServerSession() → session cookie           │
│    ├─► getStrategies()    → Prisma DB query          │
│    │                                                 │
│    └─► <WorkspaceGrid initialStrategies={data} />    │
│              │  (props serialized as JSON)            │
└──────────────┼───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│                  CLIENT (Browser)                     │
│                                                      │
│  WorkspaceGrid ("use client")                        │
│    │                                                 │
│    ├─► useEffect → dispatch(setStrategies(initial))  │
│    │              ↓                                  │
│    │   ┌─── Redux Store ───────────────────┐         │
│    │   │ workspace: { strategies, sortBy,  │         │
│    │   │   sortDirection, filterType, ... } │         │
│    │   └───────────────────────────────────┘         │
│    │              ↓                                  │
│    ├─► useMemo(filter + sort) → displayStrategies    │
│    │              ↓                                  │
│    └─► map(displayStrategies → StrategyCard)         │
│                                                      │
│  WorkspaceToolbar                                    │
│    └─► Select onChange → dispatch(setSortBy/...)     │
│        (triggers re-render → useMemo re-computes)    │
└──────────────────────────────────────────────────────┘
```

---

## Section: Loading and Error Boundaries

Next.js App Router provides two special files per route segment for handling async states:

### `loading.tsx` — Skeleton UI

```tsx
// app/dashboard/loading.tsx
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-5 w-96 animate-pulse rounded bg-muted" />
      </div>

      {/* Toolbar skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-[160px] animate-pulse rounded bg-muted" />
        <div className="h-10 w-[140px] animate-pulse rounded bg-muted" />
        <div className="h-10 w-[170px] animate-pulse rounded bg-muted" />
        <div className="flex-1" />
        <div className="h-10 w-[120px] animate-pulse rounded bg-muted" />
      </div>

      {/* Card grid skeleton — 6 placeholders */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 w-3/4 rounded bg-muted" />
              <div className="mt-1 h-4 w-1/2 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-3 w-2/5 rounded bg-muted" />
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="space-y-1">
                    <div className="h-3 w-12 rounded bg-muted" />
                    <div className="h-5 w-16 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <div className="h-8 w-24 rounded bg-muted" />
              <div className="h-8 w-20 rounded bg-muted" />
              <div className="h-8 w-16 rounded bg-muted" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

**Key design principles for skeletons:**

1. **Match the layout geometry.** Each skeleton element mirrors the real component's dimensions: the same 3-column grid, the same card structure (header → content → footer). This prevents layout shift when real data arrives.

2. **Use `animate-pulse`.** Tailwind's built-in pulse animation applies an opacity cycle on the `bg-muted` backgrounds, signaling "loading" without custom CSS.

3. **Use `Array.from({ length: 6 })`.** Six cards fill a 3×2 grid — a reasonable default. The exact count doesn't need to match the real data because the skeleton disappears entirely once `page.tsx` finishes rendering.

### `error.tsx` — Error Boundary

```tsx
// app/dashboard/error.tsx
"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || "Failed to load your workspace."}
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
```

**Why `"use client"`?** Error boundaries in Next.js must be Client Components because they use `reset()` (a function callback). The `reset` function re-renders the route segment, retrying the Server Component's data fetch.

**Why does our `page.tsx` also have `try/catch`?** Belt-and-suspenders approach. The `try/catch` in the page handles expected failures (DB timeout) silently, showing an empty workspace. The `error.tsx` boundary catches *unexpected* errors (code bugs, network failures) with a retry option. Together they cover both graceful degradation and crash recovery.

---

## Section: The Empty State UX

The empty state differentiates between "no data at all" and "no data matching current filters":

```tsx
{displayStrategies.length === 0 ? (
  <div className="flex flex-col items-center ... border-dashed py-16">
    <h3 className="text-lg font-medium">No strategies found</h3>
    <p className="mt-1 text-sm text-muted-foreground">
      {strategies.length === 0
        ? "Create your first backtest to get started."
        : "No strategies match the current filters."}
    </p>
    {strategies.length === 0 && (
      <Link href="/dashboard/new" className="mt-4 ...">
        New Backtest →
      </Link>
    )}
  </div>
) : (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {displayStrategies.map((strategy) => (
      <StrategyCard key={strategy.id} strategy={strategy} />
    ))}
  </div>
)}
```

The check `strategies.length === 0` (unfiltered list) vs `displayStrategies.length === 0` (filtered list) tells us which message to show. If the unfiltered list is empty, the user is new — show a CTA link to create their first backtest. If there *are* strategies but none match the filter, tell them to adjust the filter (no CTA needed).

---

## Section: Why We Made This Choice — Server Fetch vs. Client Fetch

| Criterion | Server Fetch (chosen) | Client Fetch |
|---|---|---|
| First paint | Data in initial HTML | Spinner, then data after JS loads |
| SEO / SSR | Content visible to crawlers | Not visible |
| Waterfall | Single request (DB → HTML → browser) | HTML → JS → API → render |
| Complexity | Low (just a function call) | Higher (API route + hook + loading state) |
| Offline / SPA feel | Requires page reload for fresh data | Can refetch in background |

For a dashboard page that users navigate to frequently, the server fetch approach gives a substantially better first-paint experience. The trade-off — no background refetching — is acceptable because strategies change infrequently (only when the user creates/deletes one, which is handled by Redux mutations).

---

## Key Takeaway

> **Fetch on the server, interact on the client.** Server Components eliminate the loading spinner for initial data. Pass the fetched data as props to a Client Component that hydrates Redux, enabling instant client-side sorting and filtering without round-trips. Use `useMemo` to derive the display list from Redux state — it's fast, reactive, and keeps the component tree simple.

---

**Next:** [Lesson 34 — Cross-Slice Redux Communication: Duplicate, Delete & Compare Flows](./34-cross-slice-redux-duplicate-delete-compare.md)

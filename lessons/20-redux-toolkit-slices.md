# Lesson 20 — Redux Toolkit: Slices, the Client/Server State Boundary, and Typed Hooks

State management is one of the most frequently misunderstood topics in Next.js App Router
applications. The App Router pushes strongly toward server-side data fetching, which leads
to a reasonable question: if the server can fetch data and render it directly into HTML, why
do we need Redux at all? This lesson answers that question precisely, then shows how Phase 4
designed four Redux slices to hold the specific kinds of state that the server genuinely
cannot manage.

---

## Section: What Redux Manages (and What It Doesn't)

The App Router makes a clear distinction between two kinds of state:

| State Type | Where It Lives | Who Manages It |
|---|---|---|
| Persisted data (strategies, runs) | PostgreSQL via Prisma | Server Components + Server Actions |
| Transient UI state (form drafts, progress %) | Browser memory | Redux |

Redux in this project handles exactly four things, none of which can be server-rendered:

1. **Strategy Builder form draft** — the user is typing into a form; that in-progress state
   doesn't exist in the database yet and must survive navigation between form steps
2. **Backtest run progress** — SSE events arrive in real time in the browser; they are not
   in the database until the run completes (only the `"complete"` event triggers a Prisma write)
3. **Comparison selection** — the user has checked boxes next to 3 strategies; that selection
   is transient and doesn't belong in the database
4. **Workspace sort/filter** — the user changed the sort order; that UI preference is ephemeral

Everything else — the list of saved strategies, the full results of a completed run — is
fetched server-side and passed as props. Redux never stores things that Prisma already holds.

```
Server (Prisma)            │  Client (Redux)
───────────────────────────│────────────────────────────────────────────
Strategy records           │  Form draft (pre-save)
BacktestRun results        │  Active run progress % + SSE messages
User profile               │  Comparison checkbox selections
                           │  Workspace sort order + type filter
```

---

## Section: Slice Design — strategyBuilderSlice

```typescript
// frontend/store/slices/strategyBuilderSlice.ts

export interface StrategyBuilderState {
  ticker: string;
  dateFrom: string;
  dateTo: string;
  strategyType: StrategyType | null;   // ① null before user picks a type
  parameters: Record<string, unknown>; // ② untyped — each strategy has different params
  riskSettings: RiskSettings;
  benchmark: string;
  name: string;
  tags: string[];
}
```

**① `StrategyType | null`** — The user hasn't chosen a strategy type yet when the form
first opens. `null` represents "not yet selected" and is more meaningful than an empty string
or a default sentinel value. The UI disables the "Next" button while this is `null`.

**② `Record<string, unknown>`** — Strategy parameters are different for every strategy:
Mean Reversion has `zscore_window`; MA Crossover has `fast_period` and `slow_period`;
Pairs Trading has `ticker_b`. Using a generic `Record` avoids the need for a discriminated
union type per strategy in the Redux layer. Full validation happens at submission via the
zod `backtestRequestSchema`.

### The `setStrategyType` reducer resets parameters

```typescript
setStrategyType(state, action: PayloadAction<StrategyType>) {
  state.strategyType = action.payload;
  state.parameters = {};   // ← reset when type changes
},
```

If a user builds out Mean Reversion params, then switches to MA Crossover, the old
`zscore_window` field would be sent in the payload to FastAPI — which ignores unknown
params — but it's cleaner to reset. The dynamic form component also re-renders with
empty fields, avoiding visual confusion.

### The `prefillFromStrategy` reducer powers the Duplicate flow

```typescript
prefillFromStrategy(state, action: PayloadAction<{ ... }>) {
  return { ...action.payload };   // ← return a brand-new state object
},
```

Notice it uses `return { ...action.payload }` rather than mutating `state` field-by-field.
Both are valid in Redux Toolkit (which uses Immer). The `return` form is simpler when
replacing the entire state rather than updating individual fields.

---

## Section: Slice Design — backtestSlice

```typescript
export interface BacktestState {
  runId: string | null;
  strategyId: string | null;
  status: "idle" | "running" | "completed" | "failed";
  progress: number;          // 0–100
  message: string;           // last SSE progress message
  results: BacktestResponse | null;
  error: string | null;
}
```

This slice is a **finite state machine** with a linear happy path and two terminal states:

```
idle ──► running ──► completed
              │
              └──► failed
```

The `useBacktestStream` hook drives all transitions. Each SSE event type maps to one or more
dispatch calls:

| SSE event type | Dispatches |
|---|---|
| `"progress"` | `setProgress(percent)`, `setMessage(message)` |
| `"complete"` | `setResults(results)`, `setStatus("completed")`, `setProgress(100)` |
| `"error"` | `setError(message)`, `setStatus("failed")` |

Having `status` as a string union (not a boolean `isLoading`) means the UI can conditionally
render four different states without nested conditionals:

```tsx
// Usage in a component
const { status, progress, results, error } = useAppSelector(s => s.backtest);

if (status === "idle")      return <EmptyState />;
if (status === "running")   return <ProgressBar value={progress} />;
if (status === "completed") return <ResultsDashboard data={results!} />;
if (status === "failed")    return <ErrorCard message={error!} />;
```

---

## Section: Slice Design — comparisonSlice and workspaceSlice

These two slices are simpler but illustrate two common patterns.

### comparisonSlice — toggle semantics

```typescript
toggleStrategy(state, action: PayloadAction<string>) {
  const id = action.payload;
  const idx = state.selectedIds.indexOf(id);
  if (idx >= 0) {
    state.selectedIds.splice(idx, 1);     // ① remove
    delete state.results[id];             // ② also remove its cached results
  } else {
    state.selectedIds.push(id);           // ③ add
  }
},
```

**① and ② always happen together** — If you remove a strategy ID from `selectedIds` but leave
its results in `state.results`, the comparison chart will render a ghost line from data that
no longer has a visual label. Keeping them in sync atomically in a single reducer prevents
this inconsistency.

### workspaceSlice — the loading flag

```typescript
setStrategies(state, action: PayloadAction<StrategyWithRuns[]>) {
  state.strategies = action.payload;
  state.loading = false;   // ← automatically cleared on data arrival
},
setLoading(state, action: PayloadAction<boolean>) {
  state.loading = action.payload;
},
```

The loading flag is managed by the caller:

```typescript
dispatch(setLoading(true));
const strategies = await getStrategies();
dispatch(setStrategies(strategies));   // automatically clears loading
```

Embedding the `loading = false` in `setStrategies` prevents bugs where a caller calls
`setStrategies` but forgets to call `setLoading(false)`.

---

## Section: Typed Hooks — Eliminating `any` from useSelector

Redux's built-in `useSelector` has a signature of `useSelector(selector: (state: any) => T)`.
Without typing, the `state` inside the selector is `any`, which defeats TypeScript entirely.

The fix is two lines in `store/hooks.ts`:

```typescript
// frontend/store/hooks.ts

import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

`withTypes<T>()` is a factory method added in Redux Toolkit 2.x that returns a pre-typed
version of the hook. Now:

```typescript
// ✅ state is fully typed as RootState — full autocomplete
const { ticker, strategyType } = useAppSelector(s => s.strategyBuilder);

// ✅ dispatch is typed — only valid action creators are accepted
const dispatch = useAppDispatch();
dispatch(setTicker("SPY")); // ✅ valid
dispatch({ type: "random" }); // ❌ TypeScript error
```

Without `withTypes`, a typo like `s.strategBuiler.ticker` (missing 'y') would silently
return `undefined` at runtime rather than failing at compile time.

---

## Section: Wiring the Provider into the Root Layout

The `ReduxProvider` must wrap all client components that use `useAppSelector` or
`useAppDispatch`. In Next.js App Router, providers must be client components:

```typescript
// frontend/store/provider.tsx

"use client";

import { Provider } from "react-redux";
import { store } from "./store";

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
```

And inserted into the root layout:

```tsx
// frontend/app/layout.tsx

import { ReduxProvider } from "@/store/provider";

export default async function RootLayout({ children }) {
  const session = await getServerSession();

  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>   {/* ← outer, wraps everything */}
          <ReduxProvider>                     {/* ← inner, below SessionProvider */}
            {children}
          </ReduxProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

**Why `"use client"` on the provider but not the layout?** The root layout is a Server
Component — it runs on the server and pre-fetches the session. The `ReduxProvider` must be
a Client Component because the Redux `store` object is a browser-side singleton. Marking
`provider.tsx` with `"use client"` keeps the layout server-side while letting the provider
cross the boundary. All children of `ReduxProvider` that need Redux access also become
client components (or Server Components that pass data down as props).

---

## Key Takeaway

> Redux belongs to the browser, not the database. Use it exclusively for state that is ephemeral, user-specific to one session, or updated by real-time events (like SSE). Any state that will outlive the tab — saved strategies, completed run results — belongs in Prisma and should be fetched server-side. When in doubt, ask: "would this state survive a page refresh?" If yes, it goes in the database. If no, it goes in Redux.

---

**Next:** [Lesson 21 — Server Actions vs API Routes, and Custom Hooks for SSE and Debouncing](./21-server-actions-and-hooks.md)

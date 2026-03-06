# Lesson 32 — Workspace Dashboard: Server-to-Client Data Flow & Redux-Driven Filtering

## Overview

Phase 8 builds the **Workspace Dashboard** — the main page users see after login. It fetches saved strategies on the server, passes them to a client component for sorting/filtering, and implements per-card actions (View Results, Duplicate, Delete). This lesson covers the architectural patterns used.

---

## 1. The Server → Client Handoff Pattern

The workspace page uses Next.js's **Server Component** to fetch data, then passes it as props to a **Client Component** that manages interactive state:

```tsx
// app/dashboard/page.tsx — Server Component
export default async function DashboardPage() {
  const strategies = await getStrategies(); // Prisma query on the server
  return <WorkspaceGrid initialStrategies={strategies} />;
}
```

```tsx
// components/workspace/workspace-grid.tsx — Client Component
"use client";

export function WorkspaceGrid({ initialStrategies }: { initialStrategies: StrategyWithRuns[] }) {
  const dispatch = useDispatch();

  // Hydrate Redux on mount
  useEffect(() => {
    dispatch(setStrategies(initialStrategies));
  }, [dispatch, initialStrategies]);

  // Read from Redux for rendering (includes sort/filter state)
  const { strategies, sortBy, sortDirection, filterType } = useSelector(
    (state: RootState) => state.workspace,
  );
  // ... sorting/filtering logic
}
```

**Why this pattern?**
- **Server fetch** avoids a loading spinner on initial page load — data arrives with the HTML
- **Redux hydration** enables *client-side* sorting/filtering without round-trips
- **Single source of truth** — after hydration, all state lives in Redux

---

## 2. Client-Side Sort & Filter with `useMemo`

Rather than re-fetching from the server on every sort/filter change, we derive the display list from Redux state using `useMemo`:

```tsx
const displayStrategies = useMemo(() => {
  let result = [...strategies];

  // Filter
  if (filterType) {
    result = result.filter((s) => s.type === filterType);
  }

  // Sort
  result.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "sharpe") {
      const aVal = a.runs.find(r => r.status === "COMPLETED")?.results?.metrics?.sharpe_ratio ?? -Infinity;
      const bVal = b.runs.find(r => r.status === "COMPLETED")?.results?.metrics?.sharpe_ratio ?? -Infinity;
      cmp = aVal - bVal;
    }
    // ... other sort fields
    return sortDirection === "asc" ? cmp : -cmp;
  });

  return result;
}, [strategies, sortBy, sortDirection, filterType, filterTags]);
```

**Key decisions:**
- **`-Infinity` fallback** for strategies without completed runs — they sort to the bottom
- **Metrics are nested** inside `runs[].results.metrics` — we find the latest completed run each time
- **`useMemo`** prevents unnecessary recomputation when non-sort/filter state changes

---

## 3. Per-Card Actions & Cross-Slice Communication

Each `StrategyCard` dispatches actions to *multiple* Redux slices:

| Action | Slice | Purpose |
|--------|-------|---------|
| Toggle Compare checkbox | `comparisonSlice` | `toggleStrategy(id)` — adds/removes from comparison selection |
| Delete | `workspaceSlice` | `removeStrategy(id)` — optimistic removal from the list |
| Duplicate | `strategyBuilderSlice` | `prefillFromStrategy({...})` — pre-populates the form |

This demonstrates **cross-slice communication** — a single component reads and writes to 3 different slices. Redux makes this natural since all slices share the same store.

---

## 4. The Duplicate Flow

The "Duplicate" button copies a strategy's configuration into the Strategy Builder form:

```tsx
const handleDuplicate = () => {
  dispatch(prefillFromStrategy({
    ticker: strategy.ticker,
    dateFrom: strategy.dateFrom,
    dateTo: strategy.dateTo,
    strategyType: strategy.type,
    parameters: strategy.parameters,
    riskSettings: strategy.riskSettings,
    benchmark: strategy.benchmark,
    name: `${strategy.name} (Copy)`,
    tags: strategy.tags,
  }));
  router.push("/dashboard/new");
};
```

The `prefillFromStrategy` reducer **replaces the entire builder state** (using `return { ...action.payload }`), ensuring no stale data from a previous form session bleeds through.

---

## 5. Delete with Confirmation (AlertDialog)

We use shadcn's `AlertDialog` for destructive confirmation:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" size="sm">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete strategy?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete "{strategy.name}"...
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

The delete is **optimistic** — we remove from Redux immediately while the server action runs, and show a toast on success/failure via `sonner`.

---

## 6. Testing Radix UI Components in jsdom

### The `hasPointerCapture` Problem

Radix UI's Select component calls `element.hasPointerCapture()` which doesn't exist in jsdom. We polyfill it in `vitest.setup.ts`:

```ts
if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => {};
}
```

### Testing Select Interactions

Even with the polyfill, Radix Select renders dropdown items in a *portal* that may not be queryable via `getByText` after clicking the trigger. The pragmatic approach:

1. **Test the Redux state directly** — dispatch sort/filter actions and verify rendering changes
2. **Test the trigger reflects state** — verify the Select trigger shows the correct label for the current Redux state
3. **Don't fight the DOM** — if a Radix component's internal DOM is hard to test, test the *outcome* (Redux state, rendered cards) instead

```tsx
// Instead of clicking the Select and finding an option:
it("sorts by Sharpe when sortBy is changed via Redux", () => {
  const { store } = renderWithStore(
    <WorkspaceGrid initialStrategies={[stratA, stratB, stratC]} />,
  );
  act(() => { store.dispatch(setSortBy("sharpe")); });

  const cards = within(screen.getByTestId("strategy-grid")).getAllByTestId("strategy-card");
  expect(cards[0]).toHaveTextContent("Alpha Strategy"); // highest Sharpe
});
```

---

## 7. Sonner Toast Notifications

We added the `<Toaster>` from sonner to the root layout:

```tsx
// app/layout.tsx
import { Toaster } from "@/components/ui/sonner";

<ReduxProvider>
  {children}
  <Toaster richColors closeButton />
</ReduxProvider>
```

In components, use `toast.success()` / `toast.error()` for feedback:

```tsx
import { toast } from "sonner";

try {
  await deleteStrategy(strategy.id);
  toast.success("Strategy deleted successfully");
} catch {
  toast.error("Failed to delete strategy");
}
```

In tests, mock sonner and verify calls:

```tsx
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
```

---

## Key Takeaways

1. **Server Components fetch, Client Components interact** — hydrate Redux from server-fetched props
2. **Client-side sort/filter via `useMemo`** avoids round-trips for responsive UX
3. **Cross-slice actions** let one component affect multiple state domains naturally
4. **Polyfill jsdom gaps** (ResizeObserver, pointer capture) for Radix UI tests
5. **Test outcomes, not Radix internals** — dispatch Redux actions directly when UI interaction is unreliable in jsdom
6. **Sonner for toasts** — minimal setup, easy to mock in tests

---

**Next:** [Lesson 33 — Workspace Dashboard Architecture: Server Fetch, Client Hydration & Derived State](./33-workspace-server-client-hydration.md)

# Lesson 34 — Cross-Slice Redux Communication: Duplicate, Delete & Compare Flows

A single UI component — the `StrategyCard` — dispatches actions to **three different Redux slices**. This isn't a mistake; it reflects the reality that a single user gesture ("delete this strategy") has consequences across multiple state domains. This lesson examines each flow, the architectural patterns behind them, and how we handle side effects (server calls, navigation, toast notifications) outside of Redux.

---

## Section: The Three Slices a StrategyCard Touches

```
┌─────────────────────────────────────────────────────────┐
│                     StrategyCard                         │
│                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ Duplicate │   │   Delete     │   │ Compare ☑      │  │
│  └─────┬────┘   └──────┬───────┘   └───────┬────────┘  │
│        │               │                    │           │
│        ▼               ▼                    ▼           │
│  strategyBuilder   workspace          comparison        │
│  Slice             Slice              Slice             │
│  ──────────────    ───────────────    ───────────────   │
│  prefillFrom       removeStrategy    toggleStrategy     │
│  Strategy()        (id)              (id)               │
└─────────────────────────────────────────────────────────┘
```

| Action | Target Slice | Reducer | Side Effect |
|---|---|---|---|
| Duplicate | `strategyBuilderSlice` | `prefillFromStrategy` | Navigate to `/dashboard/new` |
| Delete | `workspaceSlice` | `removeStrategy` | Server action `deleteStrategy()` + Sonner toast |
| Compare toggle | `comparisonSlice` | `toggleStrategy` | None (state only) |

This is standard Redux architecture: slices are decoupled, and the component serves as the orchestrator that knows which actions to dispatch for a given user intent.

---

## Section: The Duplicate Flow — State Replacement via `return`

### The Problem

A user clicks "Duplicate" on an existing strategy and expects the Strategy Builder form (`/dashboard/new`) to open pre-filled with that strategy's exact configuration: ticker, dates, type, parameters, risk settings, benchmark, name, and tags.

### The Naive Approach (rejected)

Dispatch individual `setTicker`, `setDateRange`, `setStrategyType`, etc. — one action per field:

```tsx
// ❌ Fragile: 9 dispatches, race conditions possible, easy to forget a field
dispatch(setTicker(strategy.ticker));
dispatch(setDateRange({ from: strategy.dateFrom, to: strategy.dateTo }));
dispatch(setStrategyType(strategy.type));
dispatch(setParameters(strategy.parameters));
// ... 5 more dispatches
```

Problems: verbose, easy to miss a field, and `setStrategyType` resets `parameters` to `{}` (by design — when the user manually changes strategy type, old parameters should clear). That side effect would wipe the parameters we're about to set.

### The Chosen Approach — Single Atomic Action

```tsx
// In strategyBuilderSlice.ts
prefillFromStrategy(
  state,
  action: PayloadAction<{
    ticker: string;
    dateFrom: string;
    dateTo: string;
    strategyType: StrategyType;
    parameters: Record<string, unknown>;
    riskSettings: RiskSettings;
    benchmark: string;
    name: string;
    tags: string[];
  }>,
) {
  return { ...action.payload };  // ← replaces entire state
},
```

**Why `return { ...action.payload }`?** In Redux Toolkit (which uses Immer under the hood), returning a new value from a reducer **replaces the entire slice state**. This is the escape hatch from Immer's proxy-based mutation model. It guarantees:

1. **No stale fields** — every field in the builder state comes from the source strategy. If the previous form had a different ticker, it's gone.
2. **Atomic update** — one dispatch, one state transition, one re-render. No intermediate states where half the fields are old and half are new.
3. **No side effects** — unlike `setStrategyType`, this reducer doesn't clear parameters.

### The Component Side

```tsx
// In strategy-card.tsx
const handleDuplicate = () => {
  dispatch(
    prefillFromStrategy({
      ticker: strategy.ticker,
      dateFrom: strategy.dateFrom,
      dateTo: strategy.dateTo,
      strategyType: strategy.type,
      parameters: strategy.parameters,
      riskSettings: strategy.riskSettings,
      benchmark: strategy.benchmark,
      name: `${strategy.name} (Copy)`,  // ← "(Copy)" suffix signals this is a clone
      tags: strategy.tags,
    }),
  );
  router.push("/dashboard/new");
};
```

The name gets `" (Copy)"` appended so the user knows they're editing a clone, not the original. The navigation happens *after* the dispatch — by the time `/dashboard/new` renders, the Redux store already has the pre-filled state, and the Strategy Builder form reads it via `useAppSelector`.

### Testing the Full Flow

```tsx
it("pre-fills the strategy builder with source data on Duplicate", async () => {
  const { store } = renderWithStore(<StrategyCard strategy={sourceStrategy} />);

  await userEvent.click(screen.getByText("Duplicate"));

  const builder = store.getState().strategyBuilder;
  expect(builder.ticker).toBe("AAPL");
  expect(builder.strategyType).toBe("MA_CROSSOVER");
  expect(builder.parameters).toEqual({
    fast_period: 10, slow_period: 50, ma_type: "EMA",
  });
  expect(builder.name).toBe("AAPL MA Crossover (Copy)");
});

it("completely overwrites any previous builder state", async () => {
  const { store } = renderWithStore(
    <StrategyCard strategy={sourceStrategy} />,
    {
      preloadedState: {
        strategyBuilder: {
          ticker: "MSFT",
          name: "Old Strategy",
          // ... other fields
        },
      },
    },
  );

  await userEvent.click(screen.getByText("Duplicate"));

  // Old "MSFT" state is gone — replaced by source strategy
  expect(store.getState().strategyBuilder.ticker).toBe("AAPL");
  expect(store.getState().strategyBuilder.name).toBe("AAPL MA Crossover (Copy)");
});
```

The second test is critical — it proves the `return { ...action.payload }` pattern actually replaces state rather than merging it. Without this test, a subtle merge bug (e.g., using `Object.assign(state, action.payload)`) could leave stale fields from a previous session.

---

## Section: The Delete Flow — Optimistic Updates + Server Actions + Toasts

### The Three Steps

```tsx
const handleDelete = async () => {
  try {
    await deleteStrategy(strategy.id);         // 1. Server action (Prisma delete)
    dispatch(removeStrategy(strategy.id));      // 2. Optimistic Redux removal
    toast.success("Strategy deleted successfully"); // 3. Success feedback
  } catch {
    toast.error("Failed to delete strategy");  // 3b. Error feedback
  }
};
```

**Wait — is this actually "optimistic"?** Not quite. True optimistic UI removes the item from Redux *before* the server confirms. Our implementation waits for the server action to succeed, *then* removes from Redux. This is **pessimistic** but still fast — the server action runs against a local database in dev and a nearby Supabase instance in production, so the delay is typically < 200ms.

A truly optimistic version would look like:

```tsx
// Hypothetical optimistic version (not what we implemented)
dispatch(removeStrategy(strategy.id));  // Remove immediately
try {
  await deleteStrategy(strategy.id);
  toast.success("Deleted");
} catch {
  dispatch(addStrategy(strategy));  // Rollback on failure
  toast.error("Failed — restored strategy");
}
```

We chose the pessimistic approach because Prisma deletions can cascade (`BacktestRun` records depend on `Strategy`), and rolling back a card after the user has already seen it disappear creates confusing UX.

### The AlertDialog Confirmation Pattern

Destructive actions should require explicit confirmation. We use shadcn's `AlertDialog`:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" size="sm">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete strategy?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete &quot;{strategy.name}&quot; and all
        its backtest runs. This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Why `AlertDialog` instead of `Dialog`?**
- `AlertDialog` traps focus and prevents clicking outside to dismiss — the user must actively choose Cancel or Delete
- `Dialog` allows backdrop clicks to close, which is appropriate for non-destructive modals (e.g., the "Save as Experiment" dialog from Phase 7)

**Why `asChild` on the trigger?** The `asChild` prop tells Radix to merge its trigger behavior onto the *child* element (our `<Button>`) instead of wrapping it in an extra `<button>`. Without `asChild`, you'd get a button-inside-a-button, which is invalid HTML and causes accessibility issues.

### Sonner Toast Setup

Sonner is a lightweight toast library. Setup requires two pieces:

**1. Root layout — mount the `<Toaster>` once:**

```tsx
// app/layout.tsx
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>
          <ReduxProvider>
            {children}
            <Toaster richColors closeButton />
          </ReduxProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

**2. Components — call `toast.success()` / `toast.error()`:**

```tsx
import { toast } from "sonner";

toast.success("Strategy deleted successfully");
toast.error("Failed to delete strategy");
```

`richColors` makes success toasts green and error toasts red. `closeButton` adds an X to dismiss manually.

### Testing Toasts

Mock sonner at the module level and verify calls:

```tsx
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
const mockToast = vi.mocked(toast);

it("shows success toast on delete", async () => {
  // ... trigger delete ...
  expect(mockToast.success).toHaveBeenCalledWith("Strategy deleted successfully");
});

it("shows error toast when delete fails", async () => {
  mockDeleteStrategy.mockRejectedValueOnce(new Error("fail"));
  // ... trigger delete ...
  expect(mockToast.error).toHaveBeenCalledWith("Failed to delete strategy");
});
```

---

## Section: The Compare Flow — Read-Only Cross-Slice State

The Compare checkbox is the simplest cross-slice interaction:

```tsx
// In strategy-card.tsx
const selectedIds = useSelector(
  (state: RootState) => state.comparison.selectedIds,
);
const isSelected = selectedIds.includes(strategy.id);

const handleToggleCompare = () => {
  dispatch(toggleStrategy(strategy.id));
};
```

```tsx
// In comparisonSlice.ts
toggleStrategy(state, action: PayloadAction<string>) {
  const id = action.payload;
  const idx = state.selectedIds.indexOf(id);
  if (idx >= 0) {
    state.selectedIds.splice(idx, 1);  // Remove
    delete state.results[id];
  } else {
    state.selectedIds.push(id);  // Add
  }
},
```

The `WorkspaceToolbar` also reads `comparison.selectedIds` to decide whether to show the "Compare Selected" button (threshold: 2+ strategies selected):

```tsx
// In workspace-toolbar.tsx
const selectedIds = useSelector(
  (state: RootState) => state.comparison.selectedIds,
);

{selectedIds.length >= 2 && (
  <Button variant="outline" size="sm" onClick={handleCompare}>
    Compare Selected
    <Badge variant="secondary" className="ml-1.5">
      {selectedIds.length}
    </Badge>
  </Button>
)}
```

This is cross-slice **reading** — the toolbar doesn't dispatch to `comparisonSlice`, it just reads from it. The StrategyCard handles the writes. Both components re-render when `selectedIds` changes because they both subscribe to the same slice via `useSelector`.

### The Navigation

```tsx
const handleCompare = () => {
  router.push(`/dashboard/compare?ids=${selectedIds.join(",")}`);
};
```

The comparison page (Phase 9) will read the `?ids` query parameter to know which strategies to compare. We also have the IDs in Redux, but the URL serves as a shareable/bookmarkable entry point.

---

## Section: Why We Made This Choice — Cross-Slice vs. Combined Slice

An alternative architecture would be a single "mega-slice" containing strategies, comparison selections, and builder draft. We rejected this because:

| Criterion | Separate Slices (chosen) | Mega-Slice |
|---|---|---|
| Code organization | Each file is ~60-80 lines, single responsibility | One file > 300 lines |
| Re-render scope | Only components subscribed to the changed slice re-render | Any change re-renders all subscribers |
| Team scalability | Different developers can own different slices | Merge conflicts on every PR |
| Testing | Test each slice in isolation | Must simulate unrelated state for every test |

The cost of separate slices is that cross-slice reads require knowing the shape of another slice (e.g., `state.comparison.selectedIds`). But TypeScript's `RootState` type makes this safe at compile time.

---

## Key Takeaway

> **One component, multiple slices, zero coupling.** A StrategyCard dispatches to `strategyBuilderSlice`, `workspaceSlice`, and `comparisonSlice` because it orchestrates user intent across state domains. Each slice stays self-contained — it doesn't know which component dispatched the action. The component is the coordinator; the slices are the specialists.

---

**Next:** [Lesson 35 — Testing Radix UI in jsdom: Polyfills, Portals & the Slot.Root Fix](./35-testing-radix-jsdom-polyfills.md)

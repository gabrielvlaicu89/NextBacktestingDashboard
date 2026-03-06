# Lesson 35 — Testing Radix UI in jsdom: Polyfills, Portals & the Slot.Root Fix

Phase 8 introduced three separate test failures that all stem from the same root cause: **Radix UI components assume a real browser environment that jsdom doesn't fully provide**. Each failure teaches a different category of jsdom limitation and a pragmatic fix. This is the most "debugging-as-teaching" lesson in the project so far — every section starts with a symptom, traces to a root cause, and extracts a mental model you can carry forward.

---

## Section: Why Radix + jsdom Is a Recurring Pain Point

Radix UI (which powers every shadcn component) is designed for real browsers. It relies on:

- **Pointer capture APIs** (`hasPointerCapture`, `setPointerCapture`, `releasePointerCapture`) — used by interactive elements like Select and Slider
- **Portal rendering** — dropdowns, dialogs, and popovers render at the end of `<body>` via React portals, outside the component tree
- **Module exports** — ESM namespace objects that may resolve differently in bundlers vs. test environments

jsdom, the DOM implementation used by Vitest (and Jest), is a spec-compliant but incomplete browser simulation. It implements the DOM and most of CSSOM but skips many Web APIs that Radix depends on.

```
┌───────────────────────────────────────────┐
│                 Real Browser               │
│                                           │
│  ✅ DOM   ✅ CSSOM   ✅ Pointer Capture   │
│  ✅ Portals render visually               │
│  ✅ focus trapping works                  │
│  ✅ Module resolution = bundler output    │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│                 jsdom (Vitest)             │
│                                           │
│  ✅ DOM   ⚠️ CSSOM   ❌ Pointer Capture  │
│  ⚠️ Portals exist but aren't "visible"   │
│  ⚠️ focus trapping partially works       │
│  ⚠️ Module resolution = Node ESM imports │
└───────────────────────────────────────────┘
```

---

## Section: Bug #1 — `hasPointerCapture is not a function`

### Symptoms

```
TypeError: target.hasPointerCapture is not a function
   at node_modules/radix-ui/internal/dist/usePointerCapture.mjs
```

This error appeared when any test rendered a component containing a shadcn `<Select>` (WorkspaceToolbar, WorkspaceGrid). The test would crash during render, before any assertions ran.

### Root Cause

Radix's internal `usePointerCapture` hook calls `element.hasPointerCapture(pointerId)` to check if the element currently has pointer capture. This is part of the [Pointer Events Level 2](https://www.w3.org/TR/pointerevents2/) spec. jsdom implements `PointerEvent` but **does not implement pointer capture methods on `Element.prototype`**.

The call chain:
```
<Select> → <SelectTrigger> → Radix Trigger → usePointerCapture hook
  → element.hasPointerCapture(pointerId)
  → ❌ TypeError: not a function
```

### The Fix

Add polyfills to `vitest.setup.ts` — a file that runs before every test:

```ts
// vitest.setup.ts
if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture !== "function") {
  Element.prototype.releasePointerCapture = () => {};
}
```

**Why return `false` for `hasPointerCapture`?** Returning `false` tells Radix that no element currently has pointer capture, which is the correct default in a non-interactive test environment. Returning `true` would cause Radix to try to release capture (calling further APIs that might also not exist) and behave differently from its uncaptured default path.

**Why guardcheck with `typeof`?** Future jsdom versions may add these methods. The guard prevents our polyfill from overwriting a real implementation.

### The Pattern — Polyfilling jsdom Gaps

This is not the first time we've needed to polyfill jsdom. In Phase 6, we added `ResizeObserver`:

```ts
// vitest.setup.ts (added in Phase 6)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
```

**The general rule**: when a Radix/shadcn component crashes in tests with a `TypeError: X is not a function`, check whether `X` is a Web API that jsdom doesn't implement. If so, add a no-op polyfill to `vitest.setup.ts`. The polyfill should return the *safest default* (empty arrays, `false`, no-ops) rather than trying to simulate real behavior.

---

## Section: Bug #2 — Select Dropdowns Are Unreachable in Tests

### Symptoms

After fixing the `hasPointerCapture` crash, tests could render the `<Select>` component. But interacting with it failed:

```tsx
// ❌ This test approach does not work
const user = userEvent.setup();
await user.click(screen.getByLabelText("Sort by"));     // Opens the dropdown
await user.click(screen.getByText("Sharpe Ratio"));     // ← Fails: element not found
```

Or alternatively, the element was found but the click didn't register, leaving the Select value unchanged.

### Root Cause

Radix Select renders its dropdown items (`SelectContent` → `SelectItem`) inside a **React portal** — a DOM node appended to `document.body`, outside the component tree. In a real browser, this works fine because the user sees both the trigger and the dropdown on screen. In jsdom, several things go wrong:

1. **No visual layout.** jsdom doesn't compute CSS layout, so Radix's positioning logic (Popper/Floating UI) may decide the dropdown is "off-screen" and not render items.
2. **`pointer-events`** and other CSS-dependent conditions may prevent interaction even if the DOM nodes exist.
3. **Portal timing.** The portal may not be populated by the time the test tries to query it, especially with Radix's animation and presence logic.

### The Fix — Test Outcomes, Not Inputs

Instead of fighting jsdom's DOM to interact with the Select dropdown, we test the **relationship between Redux state and rendered output**:

**Strategy A: Verify the trigger reflects Redux state**

```tsx
it("reflects sortBy from Redux state", () => {
  renderWithStore(<WorkspaceToolbar />, {
    preloadedState: {
      workspace: {
        strategies: [],
        loading: false,
        sortBy: "sharpe",         // ← Pre-set the Redux state
        sortDirection: "desc",
        filterType: null,
        filterTags: [],
      },
    },
  });

  // The select trigger should show the label for the current value
  expect(screen.getByLabelText("Sort by")).toHaveTextContent("Sharpe Ratio");
});
```

**Strategy B: Dispatch Redux actions and verify card ordering**

```tsx
it("sorts by Sharpe descending when sortBy changes via Redux", () => {
  const { store } = renderWithStore(
    <WorkspaceGrid initialStrategies={[stratA, stratB, stratC]} />,
  );

  act(() => {
    store.dispatch(setSortBy("sharpe"));
  });

  const cards = within(screen.getByTestId("strategy-grid"))
    .getAllByTestId("strategy-card");
  // Sharpe desc: Alpha (2.0) > Gamma (1.5) > Beta (0.8)
  expect(cards[0]).toHaveTextContent("Alpha Strategy");
  expect(cards[1]).toHaveTextContent("Gamma Strategy");
  expect(cards[2]).toHaveTextContent("Beta Strategy");
});
```

### Why This Approach Is Actually Better

Testing via Redux dispatch is **not a compromise** — it's a more focused test:

| Concern | What we're actually testing | Radix Select interaction needed? |
|---|---|---|
| Sort logic | `useMemo` comparator produces correct order | No — dispatch `setSortBy` directly |
| Filter logic | `array.filter` with `filterType` | No — dispatch `setFilterType` directly |
| Trigger label | Select displays the correct text for current value | No — preload Redux state, check text |
| Select dispatches correct action | `onValueChange` handler calls `dispatch(setSortBy(value))` | Ideally yes, but impractical in jsdom |

The only thing we *can't* test without a real browser is that the `onValueChange` callback is wired up correctly. This is a thin layer of integration that we accept verifying manually or via E2E tests (Playwright/Cypress) rather than fighting jsdom.

---

## Section: Bug #3 — `Slot` vs. `Slot.Root` (The Namespace Trap)

### Symptoms

```
Error: Element type is invalid: expected a string (for built-in components
like "div") or a class/function (for composite components) but got: object.

Check the render method of `Button`.
```

This error appeared when rendering any component that used `<Button asChild>` — in Phase 8, that was `AlertDialogTrigger asChild` (wrapping the Delete button) and `AlertDialogAction` (which uses Button internally).

### Root Cause

The shadcn `button.tsx` generated by the CLI had this code:

```tsx
import { Slot } from "radix-ui";

const Comp = asChild ? Slot : "button";
```

In a **bundler** (webpack, turbopack, esbuild), the import resolves `Slot` to the React component `Slot` which is the default/main export from `radix-ui`. But in **Vitest's Node.js ESM resolution**, `import { Slot } from "radix-ui"` resolves `Slot` to a **namespace object** (an ESM module with `.Root`, `.Slottable`, etc. as properties), not the component itself.

The difference:

```js
// In the bundler:
Slot === ReactComponent    // ✅ Can be used as <Slot />

// In Vitest/Node ESM:
Slot === { Root: ReactComponent, Slottable: ..., ... }  // ❌ Not a component
```

When React encounters an object as the component type, it throws "Element type is invalid."

### The Fix

Use the explicit `.Root` property:

```tsx
// button.tsx — before (broken in tests)
const Comp = asChild ? Slot : "button";

// button.tsx — after (works everywhere)
const Comp = asChild ? Slot.Root : "button";
```

**How did we know this was the fix?** The `badge.tsx` component (also generated by shadcn but from a newer template) already used `Slot.Root`:

```tsx
// badge.tsx — already correct
const Comp = asChild ? Slot.Root : "span";
```

The inconsistency between `button.tsx` (using `Slot`) and `badge.tsx` (using `Slot.Root`) was the clue. Both work in the bundler, but only `Slot.Root` works in all environments because it explicitly accesses the component rather than relying on how the import is resolved.

### The Mental Model — Namespace vs. Default Exports

```
┌─────────────────────────────────────────────────┐
│ import { Slot } from "radix-ui"                 │
│                                                 │
│ Bundler resolves Slot to:                       │
│   React.forwardRef(...) ← a component           │
│                                                 │
│ Node ESM resolves Slot to:                      │
│   { Root, Slottable, ... } ← a namespace object │
│                                                 │
│ import { Slot } from "radix-ui"                 │
│ Slot.Root is always:                            │
│   React.forwardRef(...) ← a component ✅        │
└─────────────────────────────────────────────────┘
```

**General rule**: When importing from a library that re-exports sub-modules (like `radix-ui`), always access the explicit sub-export (`.Root`, `.Content`, etc.) in code that will run in both bundler and Node ESM contexts. The short form (`Slot` instead of `Slot.Root`) may work in one environment but not the other.

---

## Section: The Full Testing Strategy for Phase 8

Here's how we structured the 42 tests across 4 test files:

### `strategy-card.test.tsx` — 16 tests

Focuses on a single card in isolation:

```
Rendering:
  ✓ renders name and type label
  ✓ renders date range (formatted)
  ✓ renders metrics when completed run exists
  ✓ shows "No completed runs" when no runs
  ✓ renders tags as badges
  ✓ does not render tags when empty
  ✓ renders negative return in red
  ✓ renders positive return in green

Actions:
  ✓ View Results navigates to /dashboard/results/:id
  ✓ View Results disabled when no completed run
  ✓ Duplicate dispatches prefillFromStrategy + navigates
  ✓ Delete shows AlertDialog confirmation
  ✓ Confirmed delete calls server action + removes from Redux + success toast
  ✓ Failed delete shows error toast
  ✓ Compare checkbox toggles comparisonSlice
  ✓ Checkbox reflects selected state from Redux
```

### `workspace-toolbar.test.tsx` — 11 tests

Focuses on toolbar controls and their Redux reflection:

```
Rendering:
  ✓ renders sort, direction, and filter selects
  ✓ renders New Backtest button

Actions:
  ✓ New Backtest navigates to /dashboard/new
  ✓ Compare Selected hidden when < 2 selected
  ✓ Compare Selected shown when 2+ selected
  ✓ Compare Selected navigates with IDs

State reflection:
  ✓ sort trigger shows "Sharpe Ratio" when sortBy=sharpe
  ✓ direction trigger shows "Ascending" when sortDirection=asc
  ✓ filter trigger shows "MA Crossover" when filterType=MA_CROSSOVER
  ✓ filter trigger shows "All Types" when filterType=null
  ✓ badge shows count of selected strategies
```

### `workspace-grid.test.tsx` — 11 tests

Focuses on grid rendering, sorting, and filtering (via Redux dispatch):

```
Rendering:
  ✓ renders strategy cards from props
  ✓ hydrates Redux with initial strategies

Empty states:
  ✓ shows CTA when no strategies at all
  ✓ shows filter message when strategies exist but filter matches none

Sorting:
  ✓ sorts by date descending by default
  ✓ sorts by Sharpe descending via Redux dispatch
  ✓ sorts ascending when direction changed via Redux
  ✓ sorts by Total Return via Redux dispatch

Filtering:
  ✓ filters by strategy type via Redux dispatch
  ✓ clears filter to show all again
  ✓ renders the toolbar
```

### `duplicate-flow.test.tsx` — 4 tests

End-to-end integration of the duplicate flow:

```
  ✓ pre-fills builder with full source strategy data
  ✓ appends (Copy) to name
  ✓ navigates to /dashboard/new
  ✓ overwrites previous builder state completely
```

### Why 4 Files Instead of 1?

Each file tests a different *unit of responsibility*:

| File | Unit Under Test | Dependencies Mocked |
|---|---|---|
| `strategy-card.test.tsx` | Single card: rendering + user actions | `next/navigation`, `sonner`, `deleteStrategy` |
| `workspace-toolbar.test.tsx` | Toolbar: controls + navigation | `next/navigation` |
| `workspace-grid.test.tsx` | Grid: hydration + sort/filter derived state | All of the above (child components are real) |
| `duplicate-flow.test.tsx` | Cross-slice integration: builder prefill | `next/navigation`, `sonner`, `deleteStrategy` |

The grid test renders real `StrategyCard` children (not mocks), making it a **shallow integration test**. The duplicate-flow test verifies cross-slice state changes, making it a **Redux integration test**.

---

## Section: Key Takeaway Table — jsdom Polyfill Cheat Sheet

For future reference, here's every polyfill we've added to `vitest.setup.ts` across all phases:

| Missing API | Error Message | Polyfill | Added In |
|---|---|---|---|
| `ResizeObserver` | `ResizeObserver is not defined` | `global.ResizeObserver = class { observe() {} ... }` | Phase 6 |
| `hasPointerCapture` | `target.hasPointerCapture is not a function` | `Element.prototype.hasPointerCapture = () => false` | Phase 8 |
| `setPointerCapture` | (preventive — called by same Radix code) | `Element.prototype.setPointerCapture = () => {}` | Phase 8 |
| `releasePointerCapture` | (preventive — called by same Radix code) | `Element.prototype.releasePointerCapture = () => {}` | Phase 8 |

---

## Key Takeaway

> **jsdom is an incomplete browser.** When Radix UI crashes in tests, the cause is almost always a missing Web API. Fix it with a minimal polyfill that returns the safest default. When Radix's portal rendering makes dropdown interactions unreliable in tests, stop fighting the DOM — dispatch Redux actions directly and test the *outcomes* (rendered card order, trigger labels, state changes). Reserve real browser interaction testing for E2E tools like Playwright.

---

**Next:** Lesson 36 will cover Phase 9 — Strategy Comparison page and Parameter Optimization.

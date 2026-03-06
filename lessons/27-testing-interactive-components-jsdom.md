# Lesson 27 — Testing Interactive Components in jsdom

Phase 6 introduced eight complex UI components: combobox pickers, calendar popovers,
card-based radio groups, dynamic form renderers, and a Redux-connected orchestrator. All
of them need to be tested in Vitest's jsdom environment, which doesn't implement every
browser API. This lesson covers the `renderWithStore` test helper, the ResizeObserver
polyfill, the strategy for testing Radix UI popovers, and three bugs that reveal how
to think about testing catalog-driven interactive components.

---

## Section: The renderWithStore Helper

Most Phase 6 components don't need Redux — they receive props and fire callbacks. But
the orchestrator (`StrategyBuilderForm`), the `RunButton`, and the `OnboardingModal` all
read from or dispatch to the Redux store. Testing them requires wrapping the component in
a `<Provider>`.

Rather than repeating this in every test file, a shared helper lives in
`__tests__/helpers/render-with-store.tsx`:

```tsx
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { render, type RenderOptions } from "@testing-library/react";
import { strategyBuilderReducer } from "@/store/slices/strategyBuilderSlice";
import { backtestReducer } from "@/store/slices/backtestSlice";
import { comparisonReducer } from "@/store/slices/comparisonSlice";
import { workspaceReducer } from "@/store/slices/workspaceSlice";
import type { RootState } from "@/store/store";

export function createTestStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: {
      strategyBuilder: strategyBuilderReducer,
      backtest: backtestReducer,
      comparison: comparisonReducer,
      workspace: workspaceReducer,
    },
    preloadedState: preloadedState as RootState,
  });
}

export function renderWithStore(
  ui: React.ReactElement,
  {
    preloadedState,
    store = createTestStore(preloadedState),
    ...renderOptions
  }: { preloadedState?: Partial<RootState>;
       store?: ReturnType<typeof createTestStore> } & Omit<RenderOptions, "wrapper"> = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
```

### Key design decisions

1. **`createTestStore` creates a fresh store per test** — no shared mutable state between
   tests. Each test runs with either default initial state or a custom `preloadedState`.

2. **All four reducers are registered** — even if a test only cares about
   `strategyBuilder`, the full store shape is available. This prevents
   `store.getState().backtest` from being `undefined` when `RunButton` reads it.

3. **The return includes `store`** — so tests can inspect the Redux state after user
   interactions:

```tsx
const { store } = renderWithStore(<OnboardingModal open onOpenChange={vi.fn()} />);
fireEvent.click(screen.getByTestId("template-MEAN_REVERSION"));
expect(store.getState().strategyBuilder.ticker).toBe("SPY");
```

### When to use which helper

| Scenario                      | Helper                          |
| ----------------------------- | ------------------------------- |
| Component has no Redux deps   | `render()` from Testing Library |
| Component reads/writes Redux  | `renderWithStore()`             |
| Need to preload specific state| `renderWithStore({ preloadedState: { … } })` |

---

## Section: The ResizeObserver Polyfill

### The problem

cmdk (the `Command` combobox library) and Radix UI's `Popover` internally use
`ResizeObserver` to position and size their floating content. jsdom doesn't implement
`ResizeObserver`, so opening a combobox popover in a test throws:

```
ReferenceError: ResizeObserver is not defined
```

### The fix

A minimal polyfill in `vitest.setup.ts`:

```typescript
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
```

This doesn't actually observe anything — it simply satisfies the API contract so cmdk and
Radix don't crash. In a test environment we don't need real resize observations because:

- jsdom has no visual layout engine; elements have zero dimensions.
- We're testing behaviour (what happens when the user selects an option), not visual
  positioning.

The polyfill is loaded via Vitest's `setupFiles` config, so it runs before every test
file:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    environment: "jsdom",
  },
});
```

### General pattern

When a third-party component depends on a browser API that jsdom doesn't implement, you
have three options:

| Option                       | When to use                              |
| ---------------------------- | ---------------------------------------- |
| Global polyfill (setup file) | API is widely needed across tests        |
| Per-file mock (`vi.stubGlobal`) | Only one test file hits the missing API |
| Skip the interaction         | The missing API isn't on the critical path |

For ResizeObserver, the global polyfill is correct because almost every component that uses
a popover (ticker search, benchmark selector, date pickers, strategy params select) will
need it.

---

## Section: Testing Radix Popovers — The `aria-expanded` Strategy

### The problem

Testing that a `Popover` opened correctly is not straightforward in jsdom. The initial
approach was:

```tsx
fireEvent.click(screen.getByTestId("ticker-search-trigger"));
await waitFor(() => {
  expect(screen.getByRole("combobox")).toBeInTheDocument();
});
```

This timed out. Radix's `PopoverContent` renders into a portal and uses animations and
`ResizeObserver` callbacks to initialise the floating layer. In jsdom, the portal may
render but the inner `Command` role="combobox" element may not be queryable via `getByRole`
because Radix doesn't fully initialise it without a layout engine.

### The fix

Instead of looking for the portal's internal content, test the trigger button's ARIA
state:

```tsx
it("sets aria-expanded on trigger when opened", async () => {
  render(<TickerSearch value="" onChange={vi.fn()} />);
  const trigger = screen.getByTestId("ticker-search-trigger");

  expect(trigger).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(trigger);

  await waitFor(() => {
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
```

### Why this works

The Radix `Popover` component manages `aria-expanded` on the trigger element directly —
this is a synchronous state change that doesn't depend on the portal being fully rendered.
It's also the semantically correct thing to test: "does the UI communicate to assistive
technology that the popover is open?" rather than "did an internal DOM node render?"

### General rule

> When testing Radix/Headless UI components in jsdom, prefer asserting on the trigger
> element's ARIA attributes (`aria-expanded`, `aria-checked`, `aria-selected`) rather
> than querying for portal content.

---

## Section: Testing Catalog-Driven Components

The strategy-type-selector renders cards from `STRATEGY_CATALOG`. A natural test approach
is:

```tsx
it("renders all 5 strategy cards", () => {
  render(<StrategyTypeSelector value={null} onChange={vi.fn()} />);
  const cards = screen.getAllByRole("radio");
  expect(cards).toHaveLength(5);
});
```

This works, but the more valuable tests assert against the catalog data directly:

```tsx
import { STRATEGY_CATALOG } from "@/lib/strategy-catalog";

it("renders correct labels", () => {
  render(<StrategyTypeSelector value={null} onChange={vi.fn()} />);
  for (const item of STRATEGY_CATALOG) {
    expect(screen.getByText(item.label)).toBeInTheDocument();
  }
});

it("renders correct descriptions", () => {
  render(<StrategyTypeSelector value={null} onChange={vi.fn()} />);
  for (const item of STRATEGY_CATALOG) {
    expect(screen.getByText(item.description)).toBeInTheDocument();
  }
});
```

By importing `STRATEGY_CATALOG` in the test, the assertions stay in sync with the source
data. If you rename "Mean Reversion" to "Mean-Reversion Z-Score" in the catalog, the test
passes without changes — because it's reading the same data the component reads.

### Structural invariant tests

The `strategy-catalog.test.ts` file doesn't render any component — it validates the raw
catalog data:

```typescript
it("every number param has min defined", () => {
  for (const strategy of STRATEGY_CATALOG) {
    for (const param of strategy.params) {
      if (param.type === "number") {
        expect(param.min).toBeDefined();
      }
    }
  }
});
```

This is how we caught the missing `min` on `eps_surprise_threshold`. Structural invariant
tests are a safety net that no amount of visual interaction testing would catch —  an
`<Input type="number">` without a `min` attribute renders fine and accepts user input, but
the HTML constraint validation is silently weaker than intended.

---

## Section: What Broke and How We Fixed It

### Bug — Popover content query timed out

**Symptoms:**

```
Error: Timed out in waitFor after 1000ms
  Testing: screen.getByRole("combobox")
```

**Root cause:** Radix `PopoverContent` renders into a portal. In jsdom, without a layout
engine, the portal mounts but `ResizeObserver` callbacks (needed to position the content)
fire synchronously with no-ops (our polyfill). The inner `Command` component may still not
resolve its `role="combobox"` attribute in time for the synchronous `getByRole` check inside
`waitFor`.

**Fix:** Stop querying the portal. Assert `aria-expanded="true"` on the trigger button
instead:

```tsx
// Before (fails in jsdom)
fireEvent.click(trigger);
await waitFor(() => screen.getByRole("combobox"));

// After (reliable in jsdom)
fireEvent.click(trigger);
await waitFor(() => {
  expect(trigger).toHaveAttribute("aria-expanded", "true");
});
```

**General lesson:** jsdom is not a browser. Portals, floating UI, and resize-dependent
positioning may partially initialise or not initialise at all. Test the **contract** (ARIA
attributes, callbacks fired, state changes) rather than the **implementation** (specific DOM
nodes in portals).

---

## Section: Testing the Onboarding Modal — Verifying Template Dispatch

The onboarding modal test verifies that clicking a template card dispatches
`prefillFromStrategy` with the correct data. Rather than mocking Redux, it uses the real
store via `renderWithStore`:

```tsx
it("dispatches prefillFromStrategy with SPY Mean Reversion template", () => {
  const onOpenChange = vi.fn();
  const { store } = renderWithStore(
    <OnboardingModal open onOpenChange={onOpenChange} />
  );

  fireEvent.click(screen.getByTestId("template-MEAN_REVERSION"));

  const state = store.getState().strategyBuilder;
  expect(state.ticker).toBe("SPY");
  expect(state.strategyType).toBe("MEAN_REVERSION");
  expect(state.dateFrom).toBe("2020-01-01");
  expect(state.dateTo).toBe("2024-12-31");
  expect(state.parameters).toEqual({
    zscore_window: 20,
    zscore_threshold: 2.0,
    holding_period: 10,
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
```

This approach tests through the real Redux reducer, so it verifies both:
- The component dispatches the correct action payload.
- The reducer correctly merges the template into state.

If either side has a bug (wrong field name, wrong reducer logic), the test catches it.
Mocking the dispatch would only test the first half.

---

## Key Takeaway

> In jsdom, test the **contract** — ARIA attributes, Redux state changes, callback invocations — not the rendering internals of portal-based components. Use a global `ResizeObserver` polyfill because many UI libraries depend on it, a shared `renderWithStore` helper to keep Redux test setup DRY, and structural invariant tests on your catalog data to catch omissions that runtime testing won't reveal.

---

**Next:** [Lesson 28 — Results Dashboard: Orchestrating Server Data and Client State](./28-results-dashboard-orchestration.md)

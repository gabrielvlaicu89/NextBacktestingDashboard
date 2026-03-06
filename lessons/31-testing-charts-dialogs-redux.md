# Lesson 31 — Testing Canvas Charts, Dialogs, and Redux-Connected Dashboards

Phase 7 added 97 new tests across 9 files, bringing the project total to 283 passing tests. The components tested in this phase — canvas-based charts, interactive dialogs, and a Redux-orchestrated dashboard — each require a different testing strategy. This lesson covers the three patterns: **mocking imperative libraries**, **testing user interaction flows**, and **preloading Redux state for integration tests**.

---

## Section: The Testing Spectrum for UI Components

Not all components deserve the same testing approach:

```
Pure presentational     Interactive dialog     Redux orchestrator
(PerformanceCards)      (SaveExperimentDialog) (ResultsDashboard)
       │                        │                      │
       ▼                        ▼                      ▼
  Direct render            userEvent +              renderWithStore +
  + query text           mock server action        mock child components
```

| Component Type | Test Approach | Why |
|---|---|---|
| Presentational | `render()` + `screen.getByText()` | No interactivity, just assert output matches props |
| Canvas chart | Mock the charting library, assert calls | Canvas can't render in jsdom |
| Dialog with interaction | `userEvent` to type/click, `waitFor` for async | Simulates real user behavior |
| Redux-connected orchestrator | `renderWithStore` with preloaded state, mock children | Tests state-to-UI mapping without children's complexity |

---

## Section: Mocking Lightweight Charts for Canvas Components

Lightweight Charts creates an HTML `<canvas>` element and draws with the 2D rendering context. jsdom (the DOM emulator Vitest uses) has `<canvas>` elements but **no rendering context** — `getContext('2d')` returns `null`. The chart library crashes immediately.

The solution: mock the entire module so `createChart` returns a fake object that records method calls:

```tsx
// __tests__/components/equity-curve-chart.test.tsx

const mockSetData = vi.fn();
const mockFitContent = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemove = vi.fn();
const mockAddSeries = vi.fn(() => ({ setData: mockSetData }));

vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => ({
    addSeries: mockAddSeries,
    timeScale: () => ({ fitContent: mockFitContent }),
    applyOptions: mockApplyOptions,
    remove: mockRemove,
  })),
  LineSeries: "LineSeries",
  ColorType: { Solid: "Solid" },
}));
```

This mock mimics the **shape** of the chart API without rendering anything. The key design choices:

1. **`mockAddSeries` returns `{ setData: mockSetData }`** — the component calls `chart.addSeries(LineSeries, options)` and then calls `.setData()` on the result. Our mock chains correctly.

2. **`LineSeries: "LineSeries"` is a simple string** — the component passes `LineSeries` as the first arg to `addSeries`. Since we control the mock, the value doesn't matter — we just need it to exist.

3. **`timeScale: () => ({ fitContent: mockFitContent })` uses a function** — the component calls `chart.timeScale().fitContent()`, which is a chained call. The arrow function returns a fresh object each time.

With this mock, we can write meaningful assertions:

```tsx
it("creates two series (portfolio + benchmark)", () => {
  render(<EquityCurveChart data={sampleData} />);
  expect(mockAddSeries).toHaveBeenCalledTimes(2);
});

it("calls fitContent on the time scale", () => {
  render(<EquityCurveChart data={sampleData} />);
  expect(mockFitContent).toHaveBeenCalledOnce();
});
```

We're testing the component's **behavior** (does it create two series? does it fit the content?) without testing the chart library's rendering.

---

## Section: Mocking Recharts ResponsiveContainer

Recharts has a different problem. Most of its components render SVG elements that work fine in jsdom. But `<ResponsiveContainer>` measures the parent element's dimensions using `getBoundingClientRect()` — which returns `{ width: 0, height: 0 }` in jsdom (there's no layout engine).

The fix is a **partial mock** — keep all of Recharts but replace just the one problematic component:

```tsx
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});
```

The critical detail is `async (importOriginal)`. The older pattern — `vi.importActual("recharts")` inside a non-async factory — returns a Promise that never gets awaited, so the spread produces `...Promise` (empty). The `importOriginal` parameter passed by Vitest is the proper way to get the real module.

What went wrong initially:

```tsx
// BROKEN — vi.importActual returns a Promise, not the module
vi.mock("recharts", () => {
  const OriginalModule = vi.importActual("recharts"); // ← Promise!
  return { ...OriginalModule, ResponsiveContainer: /* ... */ };
});
```

Error: `No "BarChart" export is defined on the "recharts" mock`

The fix was switching to the async factory signature:

```tsx
// FIXED — importOriginal is properly awaited
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return { ...actual, ResponsiveContainer: /* ... */ };
});
```

**The general lesson:** When partially mocking a module in Vitest, always use the `async (importOriginal)` factory signature. The `vi.importActual()` function inside a `vi.mock()` factory is asynchronous and must be awaited.

---

## Section: Testing Dialog Interaction with userEvent

The `SaveExperimentDialog` test file uses `@testing-library/user-event` instead of `fireEvent`. Here's why:

| Feature | `fireEvent` | `userEvent` |
|---|---|---|
| Click | Dispatches a single `click` event | Dispatches `pointerDown`, `mouseDown`, `pointerUp`, `mouseUp`, `click` (full browser sequence) |
| Typing | Sets value directly | Types character by character, triggering `keyDown`, `keyPress`, `input`, `keyUp` per keystroke |
| Focus | Must be managed manually | Handles focus automatically as a real user would |
| Async | Synchronous | Returns promises (must `await`) |

For a dialog that has Enter-key handling on the tag input, `userEvent` is essential:

```tsx
it("adds a new tag via Enter key", async () => {
  render(<SaveExperimentDialog {...defaultProps} />);
  await userEvent.click(screen.getByTestId("save-experiment-trigger"));

  const tagInput = screen.getByTestId("experiment-tag-input");
  await userEvent.type(tagInput, "intraday{Enter}");

  expect(screen.getByTestId("tag-intraday")).toBeInTheDocument();
});
```

`userEvent.type(input, "intraday{Enter}")` types each character, then presses Enter. This triggers the component's `onKeyDown` handler naturally. With `fireEvent`, you'd need separate `fireEvent.change()` and `fireEvent.keyDown()` calls.

### Testing server action calls

The server action `updateStrategy` is mocked at the module level:

```tsx
vi.mock("@/lib/actions/strategies", () => ({
  updateStrategy: vi.fn(),
}));

import { updateStrategy } from "@/lib/actions/strategies";
const mockUpdateStrategy = vi.mocked(updateStrategy);
```

Then in tests:

```tsx
it("calls updateStrategy with correct args on save", async () => {
  const onSaved = vi.fn();
  render(<SaveExperimentDialog {...defaultProps} onSaved={onSaved} />);
  await userEvent.click(screen.getByTestId("save-experiment-trigger"));
  await userEvent.click(screen.getByTestId("save-experiment-button"));

  await waitFor(() => {
    expect(mockUpdateStrategy).toHaveBeenCalledWith("strat-1", {
      name: "My Strategy",
      tags: ["momentum", "daily"],
    });
  });
  expect(onSaved).toHaveBeenCalledWith("My Strategy", ["momentum", "daily"]);
});
```

The `waitFor` wrapper is needed because `handleSave` is async — it calls `await updateStrategy(...)` which resolves on the next microtask tick.

### Testing error paths

```tsx
it("shows error when server action fails", async () => {
  mockUpdateStrategy.mockRejectedValueOnce(new Error("Network error"));
  // ... open dialog, click save ...

  await waitFor(() => {
    expect(screen.getByTestId("save-error")).toBeInTheDocument();
  });
  expect(screen.getByText("Network error")).toBeInTheDocument();
});
```

`mockRejectedValueOnce` makes the mock return a rejected Promise for a single call. This simulates a network failure and lets us verify the error UI appears.

---

## Section: Testing the Redux-Connected Orchestrator

`ResultsDashboard` reads from 6 Redux selectors and renders different UI based on the backtest lifecycle. Testing it requires two strategies: **preloading Redux state** and **mocking child components**.

### Preloading state

The `renderWithStore` helper from `__tests__/helpers/render-with-store.tsx` accepts a `preloadedState` that seeds all Redux slices:

```tsx
function makeBacktestState(overrides: Partial<BacktestState> = {}) {
  return {
    backtest: {
      runId: null,
      strategyId: null,
      status: "idle",
      progress: 0,
      message: "",
      results: null,
      error: null,
      ...overrides,
    },
  };
}

it("shows progress bar when backtest is running", () => {
  renderWithStore(<ResultsDashboard />, {
    preloadedState: makeBacktestState({
      status: "running",
      progress: 42,
      message: "Processing trades…",
    }),
  });
  expect(screen.getByTestId("backtest-progress")).toBeInTheDocument();
});
```

Each test seeds a different lifecycle phase and asserts the correct UI rendered.

### Mocking child components

The dashboard orchestrates 8 child components. Testing them all together would create a test that breaks for dozens of unrelated reasons. Instead, we mock every child that has its own test file:

```tsx
vi.mock("@/components/results/equity-curve-chart", () => ({
  EquityCurveChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="equity-curve-chart">Equity ({data.length} pts)</div>
  ),
}));

vi.mock("@/components/results/trade-log-table", () => ({
  TradeLogTable: ({ trades }: { trades: unknown[] }) => (
    <div data-testid="trade-log-table">Trades ({trades.length})</div>
  ),
}));
```

Each mock:
1. Renders the same `data-testid` as the real component (so presence checks work).
2. Includes the data length in the text (so we can verify correct data flows through).

This enables a powerful test: does the dashboard pass server data over Redux data?

```tsx
it("prefers savedResults over Redux results", () => {
  const altResults = { ...sampleResults, trades: [] };
  renderWithStore(
    <ResultsDashboard savedResults={sampleResults} />,
    {
      preloadedState: makeBacktestState({
        status: "completed",
        results: altResults, // Redux has 0 trades
      }),
    }
  );
  // sampleResults has 1 trade — mock renders "Trades (1)"
  expect(screen.getByText("Trades (1)")).toBeInTheDocument();
});
```

The mock's `{trades.length}` output lets us distinguish which data source the dashboard used — Redux (0 trades) or server (1 trade) — without rendering the actual table.

---

## Section: Test Assertions That Broke and Why

### Problem: `$100.00` matches multiple elements

```tsx
// BROKEN — all 3 trades have entry_price: 100
screen.getByText("$100.00"); // → TestingLibraryElementError: multiple elements
```

When multiple table rows have the same price, `getByText` finds them all and throws. The fix: use `getAllByText` and assert on the count:

```tsx
const cells = screen.getAllByText("$100.00");
expect(cells.length).toBeGreaterThanOrEqual(1);
```

### Problem: P&L text format assumption

The test expected `-$500.00`, but the component renders `$-500.00`:

```tsx
// Component template literal:
{val >= 0 ? "+" : ""}${val.toFixed(2)}
//     ↓ val = -500
// "" + "$" + "-500.00" = "$-500.00"  (not "-$500.00")
```

The template literal evaluates the sign prefix (`+` or empty string), then a literal `$`, then the number with `.toFixed(2)`. Since the number is negative, the minus sign is part of `(-500).toFixed(2)` → `"-500.00"`, producing `$-500.00`.

**The lesson:** Always read the component code before writing the test assertion. Don't assume a format — derive it from the template.

---

## Section: The Complete Testing Architecture for Phase 7

```
__tests__/components/
├── backtest-progress-bar.test.tsx     6 tests  — pure presentational
├── performance-cards.test.tsx        12 tests  — data-driven cards + exported constants
├── equity-curve-chart.test.tsx        9 tests  — full lightweight-charts mock
├── drawdown-chart.test.tsx            7 tests  — full lightweight-charts mock
├── monthly-returns-heatmap.test.tsx  14 tests  — exported getCellColor + MONTH_LABELS
├── trade-distribution-chart.test.tsx 10 tests  — partial recharts mock + bucketTrades unit
├── trade-log-table.test.tsx          15 tests  — TanStack Table sorting + pagination
├── save-experiment-dialog.test.tsx   12 tests  — userEvent interaction + server action mock
└── results-dashboard.test.tsx        14 tests  — renderWithStore + all children mocked
                                     ─── ───
                                      97 tests total
```

Notice the testing pyramid at work: most tests are fast, isolated unit tests for presentational components. Only the dashboard test is an integration test (Redux + multiple components). No E2E tests yet — those belong in Phase 11's polish phase.

---

## Key Takeaway

> The testing strategy for each component should match its complexity: **mock** what you can't render (canvas charts), **simulate** what the user does (dialog interactions via `userEvent`), and **preload** the state machine (Redux orchestrators). Never test a charting library's rendering in jsdom — test that your code calls it correctly.

---

**Next:** Lesson 32 will cover Phase 8 — Workspace Dashboard.

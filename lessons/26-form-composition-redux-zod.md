# Lesson 26 — Composing Complex Forms with Redux and Zod

The Strategy Builder form has ten or more interactive controls spread across eight sub-
components — ticker search, date pickers, strategy cards, dynamic parameters, risk
settings, benchmark, and a run button. Each sub-component needs to read shared state and
dispatch changes. This lesson explains how all eight pieces are composed into one
orchestrator, how Redux Toolkit manages the transient form state, how Zod validates the
assembled payload at the submission boundary, and the Server-to-Client prop pattern that
drives the onboarding modal.

---

## Section: The Orchestrator Pattern

`StrategyBuilderForm` (`components/strategy-builder/strategy-builder-form.tsx`) is the
single "use client" component that imports every sub-component and wires them to Redux:

```
┌─────────────────────────────────────────────┐
│            StrategyBuilderForm              │
│  (reads Redux state, dispatches actions)    │
│                                             │
│  ┌──────────────┐  ┌───────────────────┐   │
│  │ TickerSearch  │  │  DateRangePicker  │   │
│  └──────┬───────┘  └────────┬──────────┘   │
│         │                   │               │
│  ┌──────┴───────────────────┴──────────┐   │
│  │       StrategyTypeSelector          │   │
│  └──────────────────┬─────────────────┘   │
│                     │                      │
│  ┌──────────────────┴──────────────────┐   │
│  │       StrategyParamsForm            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌──────────────┐  ┌───────────────────┐   │
│  │RiskSettings  │  │BenchmarkSelector  │   │
│  └──────────────┘  └───────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │            RunButton                │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

Each sub-component receives **props only** — it has no direct knowledge of Redux. The
orchestrator reads from `useAppSelector` and dispatches via `useAppDispatch`:

```tsx
// strategy-builder-form.tsx (simplified)
const dispatch = useAppDispatch();
const builder = useAppSelector(
  (s: import("@/store/store").RootState) => s.strategyBuilder
);

return (
  <>
    <TickerSearch
      value={builder.ticker}
      onChange={(t) => dispatch(setTicker(t))}
    />
    <DateRangePicker
      dateFrom={builder.dateFrom}
      dateTo={builder.dateTo}
      onChange={(range) => dispatch(setDateRange(range))}
    />
    <StrategyTypeSelector
      value={builder.strategyType}
      onChange={(type) => dispatch(setStrategyType(type))}
    />
    {/* … more sub-components */}
  </>
);
```

### Why only the orchestrator touches Redux

| Approach                       | Pros                                    | Cons                              |
| ------------------------------ | --------------------------------------- | --------------------------------- |
| Each sub-component uses Redux  | No prop drilling                        | Coupled to store shape; hard to test |
| Orchestrator wires everything  | Sub-components are pure; easy to test   | Orchestrator is larger            |

We chose the orchestrator approach because:

1. **Testability** — sub-components like `TickerSearch` can be tested with simple props
   and mock callbacks, without needing a Redux provider.
2. **Reusability** — `TickerSearch` is reused by `BenchmarkSelector` with different props.
   If it owned its own Redux connection, it couldn't serve two different slices.
3. **Single source of truth** — the orchestrator assembles the payload for Zod validation
   in one place, so there's no risk of one sub-component reading stale state.

---

## Section: The strategyBuilderSlice

The Redux slice (`store/slices/strategyBuilderSlice.ts`) holds all form fields as a flat
state object. Key design decisions:

### 1. Flat shape, not nested

```typescript
interface StrategyBuilderState {
  name: string;
  ticker: string;
  dateFrom: string;
  dateTo: string;
  strategyType: StrategyType | null;
  parameters: Record<string, unknown>;
  riskSettings: RiskSettings;
  benchmark: string;
}
```

Every field is directly addressable, and each has its own action creator. The
`parameters` field is `Record<string, unknown>` because each strategy type has different
parameter keys — we can't statically type them without generics that would bloat the
slice.

### 2. `setParameter` uses a key-value action

```typescript
setParameter(state, action: PayloadAction<{ key: string; value: unknown }>) {
  state.parameters[action.payload.key] = action.payload.value;
}
```

This means a single action replaces the value for one parameter key. Contrast with
`setRiskSettings`, which takes a partial and merges:

```typescript
setRiskSettings(state, action: PayloadAction<Partial<RiskSettings>>) {
  Object.assign(state.riskSettings, action.payload);
}
```

The distinction matters: individual parameter keys are independent (Z-Score Window is
unrelated to Holding Period), while risk settings are a cohesive group often updated
together from a single component.

### 3. `prefillFromStrategy` for onboarding templates

```typescript
prefillFromStrategy(
  state,
  action: PayloadAction<Omit<StrategyBuilderState, "tags"> & { tags?: string[] }>
) {
  return { ...state, ...action.payload };
}
```

This wholesale replacement lets the onboarding modal load a complete pre-built strategy
in one dispatch. The spread pattern preserves any state keys not in the payload.

### 4. `resetBuilder` returns `initialState`

```typescript
resetBuilder() {
  return initialState;
}
```

Returning the initial state in an Immer reducer is the idiomatic way to do a full reset
in Redux Toolkit.

---

## Section: Zod Validation at the Submission Boundary

Validation happens **once**, in `handleRun`, not in individual sub-components:

```tsx
const handleRun = useCallback(async () => {
  setValidationError(null);

  const payload = {
    strategy_type: builder.strategyType,
    ticker: builder.ticker,
    date_from: builder.dateFrom,
    date_to: builder.dateTo,
    benchmark: builder.benchmark,
    risk_settings: builder.riskSettings,
    parameters: builder.parameters,
  };

  const result = backtestRequestSchema.safeParse(payload);
  if (!result.success) {
    const firstError = result.error.errors[0];
    setValidationError(
      `${firstError.path.join(".")}: ${firstError.message}`
    );
    return;
  }

  await startBacktest(result.data);
}, [builder, startBacktest]);
```

### Why validate only at submission, not on every keystroke?

| Timing              | UX                                          | Complexity                |
| ------------------- | ------------------------------------------- | ------------------------- |
| On every change     | Instant feedback, but noisy mid-typing      | Zod runs on every render  |
| On blur             | Good for individual fields                  | Need per-field schemas    |
| On submit           | Clean; user sees one error at a time        | Single safeParse call     |

For a form with 10+ fields, on-submit validation keeps the UX calm — the user fills in
everything, hits Run, and gets a single actionable error if something is wrong. The
validation error is displayed in a destructive-styled alert box with `role="alert"` for
screen reader announcements:

```tsx
{validationError && (
  <div
    className="rounded-md border border-destructive/50 bg-destructive/10
               p-3 text-sm text-destructive"
    role="alert"
  >
    {validationError}
  </div>
)}
```

The `backtestRequestSchema` from `lib/validations.ts` mirrors the backend's Pydantic
model — both validate the same shape. If the Zod schema passes, the FastAPI backend
should never reject the payload for structural reasons.

---

## Section: The Server-to-Client Onboarding Prop

The `app/dashboard/new/page.tsx` route is a **Server Component** that checks whether the
user has existing strategies:

```tsx
// app/dashboard/new/page.tsx
import { getStrategies } from "@/lib/actions/strategies";
import { StrategyBuilderForm } from "@/components/strategy-builder/strategy-builder-form";

export default async function NewBacktestPage() {
  let showOnboarding = false;
  try {
    const strategies = await getStrategies();
    showOnboarding = strategies.length === 0;
  } catch {
    showOnboarding = false;
  }

  return <StrategyBuilderForm showOnboarding={showOnboarding} />;
}
```

This pattern is significant:

1. **Server-only data fetch** — `getStrategies()` queries the database via a Server Action.
   That network call never runs on the client.
2. **Boolean prop** — the only data crossing the server/client boundary is a single
   boolean. No user data or strategy objects leak into the client bundle.
3. **Graceful fallback** — if the database call fails, `showOnboarding` defaults to
   `false`, so the form renders normally without crashing.

The `StrategyBuilderForm` (a client component) initialises local state from this prop:

```tsx
const [onboardingOpen, setOnboardingOpen] = useState(showOnboarding);
```

The onboarding modal displays three pre-built templates. When the user clicks one,
`prefillFromStrategy` dispatches a complete form state to Redux:

```tsx
const handleSelectTemplate = useCallback((template: StrategyTemplate) => {
  dispatch(prefillFromStrategy({
    ticker: template.ticker,
    dateFrom: template.dateFrom,
    dateTo: template.dateTo,
    strategyType: template.strategyType,
    parameters: template.parameters,
    riskSettings: template.riskSettings,
    benchmark: template.benchmark,
    name: template.name,
  }));
  onOpenChange(false);
}, [dispatch, onOpenChange]);
```

This fills in every field at once, so the form appears fully configured and the user can
immediately hit "Run Backtest" to see their first results.

---

## Section: What Broke and How We Fixed It

### Bug — `s.backtest` is of type `unknown`

**Symptoms:** TypeScript error in `run-button.tsx` and `strategy-builder-form.tsx`:
`'s.backtest' is of type 'unknown'`.

**Root cause:** The `useAppSelector` hook was typed with `withTypes<RootState>()`, but
TypeScript sometimes fails to infer the state type through the generic helper — especially
when the selector is in a file that doesn't directly import the store.

**Fix:** Add an explicit `RootState` type annotation on the selector parameter:

```tsx
// run-button.tsx
import type { RootState } from "@/store/store";

const status = useAppSelector((s: RootState) => s.backtest.status);
```

For the orchestrator, inline import syntax avoids a circular dependency:

```tsx
// strategy-builder-form.tsx
const builder = useAppSelector(
  (s: import("@/store/store").RootState) => s.strategyBuilder
);
```

**General lesson:** Redux Toolkit's `withTypes` helper improves ergonomics for simple
cases, but complex component trees may need explicit type annotations. When TypeScript
reports "unknown" on a Redux selector, the fix is always to annotate `RootState`
explicitly at the call site.

---

## Key Takeaway

> Keep sub-components "dumb" (props-in, callbacks-out) and let a single orchestrator component wire them to Redux. Validate the assembled payload once at the submission boundary with Zod — not on every keystroke. This separation makes each component independently testable, the validation logic centralised, and the data flow easy to trace from form input to API request.

---

**Next:** [Lesson 27 — Testing Interactive Components in jsdom](./27-testing-interactive-components-jsdom.md)

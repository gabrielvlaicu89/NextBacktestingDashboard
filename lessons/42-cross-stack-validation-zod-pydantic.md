# Lesson 42 — Cross-Stack Validation with Zod and Pydantic

When a user enters invalid data into a form, there are at least four places that data passes through before reaching the database: the browser form, the Next.js API proxy, the FastAPI endpoint, and the Pydantic model. If only one layer validates, invalid data leaks through the cracks. This lesson covers how we implemented *consistent* validation on both the TypeScript frontend (zod) and the Python backend (Pydantic v2), how we turned validation errors into per-field inline feedback, and why cross-field validation (like "end date must be after start date") requires a different technique than single-field rules.

---

## Section: The Two Layers of Validation

### Single-Field Rules vs Cross-Field Rules

Most validation is straightforward: "ticker must be a non-empty string," "starting_capital must be ≥ 100." These are **single-field rules** — each field can be validated in isolation.

Cross-field rules are different: "date_to must be after date_from" requires access to *two* fields simultaneously. Neither zod's `.string()` nor Pydantic's `Field()` can express this alone.

```
Single-field:     ticker → min(1) ✓ or ✗    (self-contained)
Cross-field:      date_to → depends on date_from (needs context)
```

Both zod and Pydantic solve this with a "refine" step that runs *after* all individual fields pass.

---

## Section: Backend — Pydantic `model_validator`

### The Problem

Before Phase 11, nothing stopped a user from sending `date_from: "2024-12-31"` and `date_to: "2024-01-01"` to the backtest endpoint. The data would be fetched, yfinance would return an empty DataFrame, and the strategy engine would crash with an obscure pandas error.

### The Fix

Pydantic v2 provides `@model_validator(mode="after")` — a method that runs after all field validators succeed, giving access to the fully constructed model:

```python
# backend/app/models/schemas.py
from pydantic import BaseModel, Field, model_validator

class BacktestRequest(BaseModel):
    strategy_type: StrategyType
    ticker: str
    date_from: date
    date_to: date
    benchmark: str = "SPY"
    risk_settings: RiskSettings = Field(default_factory=RiskSettings)
    parameters: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_date_range(self) -> "BacktestRequest":
        if self.date_to <= self.date_from:
            raise ValueError("date_to must be after date_from")
        return self
```

The same validator is applied to `OptimizeRequest`:

```python
class OptimizeRequest(BaseModel):
    # ... fields ...
    param_ranges: dict[str, ParamRange]
    optimize_for: str = "sharpe_ratio"

    @model_validator(mode="after")
    def validate_date_range(self) -> "OptimizeRequest":
        if self.date_to <= self.date_from:
            raise ValueError("date_to must be after date_from")
        return self
```

### How It Works

Pydantic's validation pipeline runs in this order:

```
Step 1: Parse raw JSON → coerce types (str "2024-01-01" → date object)
Step 2: Field validators run (ge=100, gt=0, etc.)
Step 3: model_validator(mode="after") runs — model is fully constructed
Step 4: If any step raises, FastAPI returns HTTP 422 with error details
```

`mode="after"` is critical — if we used `mode="before"`, we'd receive raw dicts and strings, not typed `date` objects. With `mode="after"`, `self.date_to` and `self.date_from` are already `datetime.date` instances, so `<=` works correctly.

### Why Not `@field_validator`?

Pydantic's `@field_validator` operates on a single field. You can't access `self.date_from` inside a validator for `date_to` because field order isn't guaranteed. `@model_validator(mode="after")` is the correct tool for cross-field rules.

---

## Section: Frontend — Zod `.refine()`

### The Problem

Without frontend validation, the user would fill in a reversed date range, click Run, wait for the request to reach FastAPI, and only *then* see a 422 error. This round-trip wastes time and feels sluggish. The validation should fire instantly in the browser.

### The Fix

Zod's `.refine()` is the equivalent of Pydantic's `model_validator` — it runs after the base schema validates and can access the full parsed object:

```typescript
// lib/validations.ts
export const backtestRequestSchema = z.object({
  strategy_type: z.enum(STRATEGY_TYPES),
  ticker: z.string().min(1, "Ticker is required").max(10),
  date_from: dateStringSchema,
  date_to: dateStringSchema,
  benchmark: z.string().min(1).default("SPY"),
  risk_settings: riskSettingsSchema.default({}),
  parameters: z.record(z.unknown()).default({}),
}).refine(
  (data) => data.date_to > data.date_from,
  { message: "End date must be after start date", path: ["date_to"] },
);
```

The `path: ["date_to"]` is essential — it tells zod to attach the error to the `date_to` field specifically, not to the root. Without it, the error would appear as a generic form-level error with no indication of which field to fix.

### The Parallel Between Zod and Pydantic

| Concept | Zod | Pydantic v2 |
|---|---|---|
| Single-field validation | `.min()`, `.max()`, `.regex()` | `Field(ge=, le=, pattern=)` |
| Cross-field validation | `.refine()` / `.superRefine()` | `@model_validator(mode="after")` |
| Error targeting | `path: ["field_name"]` | Default path or `ValueError` |
| Runs after | Base `.object()` schema | All field validators |
| Access to full object | `(data) => ...` callback | `self` |

This symmetry is intentional — it means the same validation rules are enforced identically on both sides. A reversed date range is caught by zod in the browser *and* by Pydantic on the server, creating a defense-in-depth strategy.

---

## Section: Per-Field Inline Validation Errors

### The Problem

Before Phase 11, the strategy builder form had a single banner:

```
┌──────────────────────────────────────────┐
│  ⚠ Invalid input — please check all     │
│    fields and try again.                 │
└──────────────────────────────────────────┘
```

This tells the user *something* is wrong but not *what*. With 8+ form fields, finding the offending field means guessing.

### The Implementation

We replaced the single `validationError` string with a `fieldErrors` record keyed by field path:

```typescript
// strategy-builder-form.tsx
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

const handleRun = useCallback(async () => {
  setFieldErrors({});  // clear previous errors

  const result = backtestRequestSchema.safeParse(payload);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.errors) {
      const key = issue.path.join(".");      // e.g. "risk_settings.starting_capital"
      if (!errors[key]) errors[key] = issue.message;  // first error per field wins
    }
    setFieldErrors(errors);
    toast.error("Please fix the validation errors below");
    return;
  }

  await startBacktest(result.data);
}, [builder, startBacktest]);
```

The `issue.path.join(".")` call is the key transformation. Zod error paths are arrays like `["risk_settings", "starting_capital"]` — joining them with `.` produces a flat key like `"risk_settings.starting_capital"` that we can look up in the JSX:

```tsx
{/* Ticker field */}
<TickerSearch value={builder.ticker} onChange={(t) => dispatch(setTicker(t))} />
{fieldErrors["ticker"] && (
  <p className="mt-1 text-sm text-destructive"
     data-testid="field-error-ticker">
    {fieldErrors["ticker"]}
  </p>
)}

{/* Date range */}
{fieldErrors["date_to"] && (
  <p className="mt-1 text-sm text-destructive"
     data-testid="field-error-date-to">
    {fieldErrors["date_to"]}
  </p>
)}

{/* Risk settings — dynamically rendered for all nested errors */}
{Object.entries(fieldErrors)
  .filter(([key]) => key.startsWith("risk_settings."))
  .map(([key, msg]) => (
    <p key={key} className="text-sm text-destructive"
       data-testid={`field-error-${key}`}>
      {msg}
    </p>
  ))
}
```

Plus a summary banner at the bottom:

```tsx
{Object.keys(fieldErrors).length > 0 && (
  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
       role="alert">
    Please fix {Object.keys(fieldErrors).length} validation{" "}
    {Object.keys(fieldErrors).length === 1 ? "error" : "errors"} above.
  </div>
)}
```

### The Data Flow

```
User clicks "Run Backtest"
        │
        ▼
safeParse(payload) ─── success ──→ startBacktest(result.data)
        │
     failure
        │
        ▼
result.error.errors = [
  { path: ["ticker"], message: "Ticker is required" },
  { path: ["date_to"], message: "End date must be after start date" },
]
        │
        ▼
fieldErrors = {
  "ticker": "Ticker is required",
  "date_to": "End date must be after start date",
}
        │
        ▼
JSX renders: ─── {fieldErrors["ticker"]} next to ticker input
              ─── {fieldErrors["date_to"]} next to date picker
              ─── Summary: "Please fix 2 validation errors above."
              ─── toast.error("Please fix the validation errors below")
```

### Why Not `react-hook-form` Errors?

The PLAN.md mentioned "react-hook-form" — but our form doesn't use `react-hook-form`'s `register()` / `handleSubmit()` pattern. Instead, the form state lives in Redux (via `strategyBuilderSlice`), and each sub-component dispatches actions directly. Introducing `react-hook-form` would mean either duplicating state (Redux + react-hook-form) or migrating away from Redux — neither is justified just for error display. The manual `fieldErrors` pattern integrates cleanly with our existing Redux-driven architecture.

---

## Section: Testing Cross-Stack Validation

### Backend — Testing Pydantic Rejects Invalid Dates

```python
class TestDateValidation:
    def test_backtest_request_rejects_date_to_before_date_from(self):
        with pytest.raises(ValidationError, match="date_to must be after date_from"):
            BacktestRequest(
                strategy_type="MEAN_REVERSION",
                ticker="SPY",
                date_from="2024-12-31",
                date_to="2024-01-01",
            )

    def test_backtest_request_rejects_equal_dates(self):
        with pytest.raises(ValidationError, match="date_to must be after date_from"):
            BacktestRequest(
                strategy_type="MEAN_REVERSION",
                ticker="SPY",
                date_from="2024-06-15",
                date_to="2024-06-15",
            )

    def test_api_returns_422_for_invalid_dates(self, client):
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "SPY",
                "date_from": "2024-12-31",
                "date_to": "2024-01-01",
            },
        )
        assert response.status_code == 422
```

Note the three layers of testing: Pydantic model directly, Pydantic model for equal dates (boundary condition), and the full HTTP endpoint to confirm FastAPI returns 422.

### Frontend — Testing Inline Error Display

```tsx
it("shows inline date error when date_to < date_from", async () => {
  const user = userEvent.setup();
  renderWithStore(<StrategyBuilderForm />, {
    preloadedState: {
      strategyBuilder: {
        ticker: "SPY",
        dateFrom: "2024-12-31",   // ← reversed!
        dateTo: "2024-01-01",
        strategyType: "MEAN_REVERSION",
        // ... rest of valid state
      },
    },
  });

  await user.click(screen.getByTestId("run-backtest-button"));

  await waitFor(() => {
    expect(screen.getByTestId("field-error-date-to")).toBeInTheDocument();
  });
  expect(screen.getByTestId("field-error-date-to")).toHaveTextContent(
    "End date must be after start date"
  );
});
```

The test pre-loads Redux state with a reversed date range, clicks the run button, and asserts that the inline error appears next to the date_to field with the exact message. The `data-testid` attributes we added specifically for testing make these assertions reliable.

### Frontend — Testing Zod Schema Independently

```typescript
it("rejects date_to before date_from", () => {
  const result = backtestRequestSchema.safeParse({
    ...validPayload,
    date_from: "2024-12-31",
    date_to: "2024-01-01",
  });
  expect(result.success).toBe(false);
  if (!result.success) {
    const messages = result.error.errors.map((e) => e.message);
    expect(messages).toContain("End date must be after start date");
  }
});

it("reports date_to path for date range error", () => {
  const result = backtestRequestSchema.safeParse({
    ...validPayload,
    date_from: "2024-12-31",
    date_to: "2024-01-01",
  });
  expect(result.success).toBe(false);
  if (!result.success) {
    const dateErr = result.error.errors.find((e) =>
      e.message.includes("End date")
    );
    expect(dateErr?.path).toContain("date_to");
  }
});
```

Testing the schema independently from the component ensures the validation logic is correct regardless of the UI. Testing the `path` property verifies that the error will be keyed to `"date_to"` in the `fieldErrors` map — without this, the inline error would never appear.

---

## Key Takeaway

> Validate on both sides of the network boundary — zod in the browser for instant feedback, Pydantic on the server as the authoritative guard. Use `.refine()` (zod) and `@model_validator` (Pydantic) for cross-field rules, and surface errors to the user as per-field inline messages, not generic banners. The user should never have to guess which field is wrong.

---

**Next:** [Lesson 43 — Rate Limiting, Edge Cases, and Defensive Backend Design](./43-rate-limiting-edge-cases-defensive-backend.md)

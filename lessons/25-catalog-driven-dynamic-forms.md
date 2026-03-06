# Lesson 25 — Catalog-Driven Dynamic Forms

Many form-heavy applications hardcode a separate screen for every entity type: one component
for Mean Reversion settings, another for Moving Average Crossover settings, and so on.
This Phase 6 implementation takes a different approach — a single **strategy catalog** data
structure that drives all form rendering. When you add a sixth strategy to the backend, you
add one object to the catalog array and every form component adapts automatically. This
lesson explains the catalog pattern, the `param.type → component` mapping, and the
combobox search that ties it all together.

---

## Section: The Catalog Data Structure

The catalog lives in `lib/strategy-catalog.ts` and mirrors the backend's
`STRATEGY_CATALOG`. Each entry describes a strategy's UI surface:

```typescript
// lib/strategy-catalog.ts
export const STRATEGY_CATALOG: StrategyCatalogItem[] = [
  {
    type: "MEAN_REVERSION",          // matches the backend enum string
    label: "Mean Reversion",          // human-readable name
    description: "Trades when price deviates …",
    params: [
      {
        key: "zscore_window",         // maps to the backend param name
        label: "Z-Score Window",      // form label
        type: "number",               // controls which input renders
        default: 20,
        min: 5,
      },
      // …more params
    ],
  },
  // …4 more strategies
];
```

The `StrategyCatalogItem` and `StrategyParam` types are defined in `lib/types.ts`:

```typescript
export interface StrategyParam {
  key: string;
  label: string;
  type: "number" | "select" | "ticker";   // ← the discriminant
  default?: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];                      // only when type === "select"
}

export interface StrategyCatalogItem {
  type: StrategyType;
  label: string;
  description: string;
  params: StrategyParam[];
}
```

Two utility exports make lookups fast:

| Export             | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `getCatalogItem()` | Look up a single `StrategyCatalogItem` by type   |
| `STRATEGY_LABELS`  | `Record<StrategyType, string>` for display names |

`STRATEGY_LABELS` is derived at module load time with `Object.fromEntries`, so it never
drifts from the catalog:

```typescript
export const STRATEGY_LABELS: Record<StrategyType, string> =
  Object.fromEntries(
    STRATEGY_CATALOG.map((item) => [item.type, item.label])
  ) as Record<StrategyType, string>;
```

The `as Record<…>` cast is necessary because `Object.fromEntries` returns
`{ [k: string]: string }` — TypeScript can't narrow the keys.

---

## Section: The Param Type → Component Mapping

`StrategyParamsForm` in `components/strategy-builder/strategy-params-form.tsx` is the
heart of the pattern — a single component that dynamically renders different controls
based on `param.type`:

```
param.type === "number"  → <Input type="number" min={…} max={…} step={…} />
param.type === "select"  → <Select> with <SelectItem> per option
param.type === "ticker"  → <TickerSearch> combobox
```

The full rendering loop:

```tsx
const catalogItem = getCatalogItem(strategyType);

return (
  <div className="space-y-4">
    {catalogItem.params.map((param) => {
      const currentValue = parameters[param.key] ?? param.default ?? "";

      if (param.type === "number") {
        return (
          <div key={param.key}>
            <Label htmlFor={`param-${param.key}`}>{param.label}</Label>
            <Input
              id={`param-${param.key}`}
              type="number"
              min={param.min}
              max={param.max}
              step={param.step ?? 1}
              value={currentValue as number}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                onParameterChange(param.key, val);
              }}
            />
          </div>
        );
      }

      if (param.type === "select" && param.options) {
        return (
          <div key={param.key}>
            <Label>{param.label}</Label>
            <Select
              value={String(currentValue)}
              onValueChange={(val: string) =>
                onParameterChange(param.key, val)
              }
            >
              {/* SelectTrigger + SelectContent + SelectItems */}
            </Select>
          </div>
        );
      }

      if (param.type === "ticker") {
        return (
          <TickerSearch
            label={param.label}
            value={String(currentValue ?? "")}
            onChange={(ticker) => onParameterChange(param.key, ticker)}
          />
        );
      }

      return null;
    })}
  </div>
);
```

Three edge cases that control the early-exit paths:

1. **`strategyType` is null** → show "Select a strategy type to configure parameters."
2. **`catalogItem.params` is empty** (Buy & Hold) → show "{label} has no configurable parameters."
3. **The `key` prop** uses `param.key`, which is unique per strategy — React reconciles properly even when the user switches strategy types.

---

## Section: Why We Made This Choice

### Alternative: One component per strategy

The straightforward approach would be five dedicated form components
(`MeanReversionForm`, `MACrossoverForm`, etc.) each with hardcoded fields:

| Approach              | Pros                            | Cons                                  |
| --------------------- | ------------------------------- | ------------------------------------- |
| Catalog-driven        | Add strategy = add 1 object     | Indirection; harder to customise one  |
| Per-strategy component| Full control per form           | N components to maintain; duplication |

The catalog approach wins because:

- **The params are uniform**: every strategy needs labelled numbers, selects, or ticker
  pickers. There's no strategy that needs a fundamentally different control type.
- **The backend already defines the param schema**: mirroring it in one place avoids drift
  between the frontend forms and the backend validation.
- **Buy & Hold validates the design**: a strategy with zero params is handled by a single
  `if (params.length === 0)` check, not a whole empty component.

If a strategy ever needed a truly custom input (e.g. a visual price-level picker), you'd
add a new `param.type` value and a new branch in the mapping function — keeping the
centralised architecture intact.

---

## Section: The Combobox Pattern — `shouldFilter={false}`

The `TickerSearch` component uses cmdk's `Command` combobox inside a Radix `Popover`.
One critical prop deserves its own explanation:

```tsx
<Command shouldFilter={false}>
  <CommandInput
    placeholder={placeholder}
    value={query}
    onValueChange={setQuery}
  />
  <CommandList>
    {/* render results from useTickerSearch hook */}
  </CommandList>
</Command>
```

By default, cmdk's `Command` component performs **client-side fuzzy filtering** on the
items. That's useful for static lists, but our ticker data is fetched from a server API.
Setting `shouldFilter={false}` tells cmdk: "I'll handle filtering myself — just render
whatever items I give you."

The filtering is handled by the `useTickerSearch` hook, which debounces the query,
calls the proxy API endpoint, and returns results asynchronously. The flow:

```
User types → onValueChange(query)
               │
               ▼
         useTickerSearch
         ┌───────────────────┐
         │ 300ms debounce    │
         │ AbortController   │──── cancels stale requests
         │ fetch(/api/tickers│
         │   /search?q=…)    │
         └───────────────────┘
               │
               ▼
         results[] → mapped to <CommandItem> elements
```

Because `shouldFilter={false}`, cmdk renders the server's results directly without
re-filtering them — preserving the backend's sorting and matching logic.

---

## Section: What Broke and How We Fixed It

### Bug 1 — `onValueChange` implicit `any`

**Symptoms:** TypeScript error: `Parameter 'val' implicitly has an 'any' type` in
`strategy-params-form.tsx` and `risk-settings-form.tsx`.

**Root cause:** The shadcn `Select` component's `onValueChange` callback type depends on
how Radix defines it. In strict TypeScript mode, passing an untyped lambda
(`(val) => …`) triggers the no-implicit-any rule.

**Fix:** Add explicit type annotations:

```tsx
// Before (fails under strict mode)
onValueChange={(val) => onParameterChange(param.key, val)}

// After
onValueChange={(val: string) => onParameterChange(param.key, val)}
```

**General lesson:** When consuming third-party component callbacks in strict TypeScript,
always annotate the callback parameter type explicitly — don't rely on type inference
flowing through the generic.

### Bug 2 — Test label mismatches

**Symptoms:** Tests for `strategy-params-form.test.tsx` could not find elements with text
"Holding Period" or "Ticker B".

**Root cause:** The actual catalog labels were "Max Holding Period (days)" and
"Second Ticker". The test assumptions were written from memory, not from the actual
catalog data.

**Fix:** Update test assertions to match the real labels in `STRATEGY_CATALOG`.

**General lesson:** When testing catalog-driven UI, import the catalog in the test file
and use its labels directly rather than hardcoding expected strings. If the label changes
in the catalog, the test adapts automatically.

### Bug 3 — Missing `min` on `eps_surprise_threshold`

**Symptoms:** Test "number params have min values set" failed — `param.min` was `undefined`
for the earnings drift EPS surprise threshold param.

**Root cause:** The catalog entry omitted the `min` property:

```typescript
// Before — min is undefined
{ key: "eps_surprise_threshold", label: "EPS Surprise Threshold (%)",
  type: "number", default: 0.0, step: 0.5 }

// After — min: 0 added
{ key: "eps_surprise_threshold", label: "EPS Surprise Threshold (%)",
  type: "number", default: 0.0, min: 0, step: 0.5 }
```

**General lesson:** A test that validates structural invariants ("every number param must
have `min` set") catches omissions that no runtime interaction would reveal. These
schema-level tests are cheap to write and prevent invalid form constraints from reaching
production.

---

## Key Takeaway

> A single catalog array that maps `param.type → component` eliminates per-strategy form duplication. Adding a new strategy becomes a data problem (add one object) rather than a code problem (write a new component). Let the catalog be the source of truth, import it in tests, and validate its structural invariants.

---

**Next:** [Lesson 26 — Composing Complex Forms with Redux and Zod](./26-form-composition-redux-zod.md)

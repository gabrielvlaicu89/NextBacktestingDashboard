# Lesson 38 — Fixing TypeScript and ESLint Errors Across a Growing Codebase

After Phase 9 landed with 397 passing tests, a full `tsc --noEmit` check revealed **42 TypeScript errors** and `eslint .` flagged **6 warnings**. None of these broke runtime behavior — every test passed, every page rendered — but they represent type-safety holes and code hygiene issues that compound over time. This lesson dissects each category of error, explains the root cause, and shows the fix. These are the kinds of bugs that silently accumulate in any growing project.

---

## Section: Why Errors Survive When Tests Pass

A passing test suite and a clean TypeScript check are measuring different things:

| Check | What it catches | What it misses |
|---|---|---|
| `vitest run` | Logic errors, rendering bugs, state transitions | Type mismatches masked by `any`, unused imports |
| `tsc --noEmit` | Type safety violations, missing generics, wrong shapes | Nothing about runtime behavior |
| `eslint .` | Style violations, unused vars, unsafe patterns | Deep type errors (that's TypeScript's job) |

In this project, the gap was caused by three factors:
1. **Prisma v6** changed its JSON field types — code written against v5 patterns compiled but was technically wrong
2. **Vitest v3** changed `vi.fn()` generics — old syntax still ran but produced `any` types
3. **Rapid Phase 9 development** added imports that were later unused after refactoring

The lesson: **run all three checks after every phase**, not just the test suite.

---

## Section: Prisma v6 JSON Field Casts (Category 1 — 5 Errors)

### The Symptom

```
error TS2322: Type 'Record<string, unknown>' is not assignable to type
  'JsonNull | InputJsonValue | undefined'.
```

This appeared in every file that writes to Prisma's `Json` type fields (`parameters` and `riskSettings` in the Strategy model).

### The Root Cause

The Prisma schema defines:

```prisma
model Strategy {
  parameters   Json   @default("{}")
  riskSettings Json   @default("{}")
}
```

In Prisma v5, `Json` fields accepted `Record<string, unknown>`. In Prisma v6, the generated types require `Prisma.InputJsonValue`, which is a recursive union type:

```typescript
type InputJsonValue = string | number | boolean | InputJsonObject | InputJsonArray | { toJSON(): unknown };
type InputJsonObject = { readonly [Key in string]?: InputJsonValue | null };
```

`Record<string, unknown>` is *not* assignable to `InputJsonObject` because `unknown` is wider than `InputJsonValue | null`. TypeScript correctly rejects it.

### The Fix — Explicit Casts

For `create` operations where we pass explicit values:

```typescript
// Before
parameters,
riskSettings,

// After
parameters: parameters as Prisma.InputJsonValue,
riskSettings: riskSettings as Prisma.InputJsonValue,
```

For `update` operations with a spread, we had to destructure the JSON fields out of the rest object to avoid the spread carrying the uncast types:

```typescript
// Before — the spread carries Record<string, unknown> types
const { dateFrom, dateTo, ...rest } = parsed.data;
const data = {
  ...rest,  // ← rest.parameters is still Record<string, unknown>
};

// After — destructure JSON fields separately
const { dateFrom, dateTo, parameters, riskSettings, ...rest } = parsed.data;
const data = {
  ...rest,
  ...(parameters !== undefined
    ? { parameters: parameters as Prisma.InputJsonValue }
    : {}),
  ...(riskSettings !== undefined
    ? { riskSettings: riskSettings as Prisma.InputJsonValue }
    : {}),
  ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
  ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
};
```

### Why Not Use `Prisma.StrategyUpdateInput`?

We initially tried typing the `data` object as `Prisma.StrategyUpdateInput`. It didn't work because this project uses a custom Prisma output path (`app/generated/prisma/client`) and the `StrategyUpdateInput` type lives inside the model-specific module, not on the `Prisma` namespace object. Rather than chase a deep re-export, the pragmatic fix was to destructure and cast only the JSON fields.

### The Import Path Gotcha

The project configures Prisma to generate to a custom path:

```typescript
// prisma.config.ts output → ./app/generated/prisma
```

This means the correct import is:

```typescript
import { Prisma } from "@/app/generated/prisma/client";  // ✅
```

Not:

```typescript
import { Prisma } from "@prisma/client";  // ❌ — different package
```

The `@prisma/client` package exists in `node_modules` but its types don't match the project's schema. The generated client at `@/app/generated/prisma/client` is the one with the correct type definitions.

---

## Section: Vitest v3 `vi.fn()` Generic Changes (Category 2 — 30 Errors)

### The Symptom

```
error TS2339: Property 'mock' does not exist on type '(config: OptimizeConfig) => void'.
```

### The Root Cause

Vitest v3 changed the `vi.fn()` generic signature:

```typescript
// Vitest v2 (old)
vi.fn<[Args], Return>()    // Two type params: arg tuple + return type

// Vitest v3 (new)
vi.fn<Fn>()                 // One type param: the full function signature
```

The test code had:

```typescript
let onSubmit: ReturnType<typeof vi.fn>;  // → type is Mock<any, any>
onSubmit = vi.fn();                       // → no generic = untyped
```

Because `ReturnType<typeof vi.fn>` resolves to `Mock<any, any>`, `.mock.calls` worked at runtime but TypeScript lost all type information. When we tried to fix it by adding a function type generic, the variable declaration needed to use `Mock<Fn>` from vitest — not just the bare function type.

### The Fix

```typescript
// Before — untyped
let onSubmit: ReturnType<typeof vi.fn>;
onSubmit = vi.fn();

// After — properly typed
import { type Mock } from "vitest";
let onSubmit: Mock<(config: OptimizeConfig) => void>;
onSubmit = vi.fn<(config: OptimizeConfig) => void>();
```

The `Mock<Fn>` type preserves the function signature *and* adds the `.mock` property with typed `calls` and `results` arrays.

### The Deprecated Syntax in `ticker-search.test.tsx`

One test file used the old two-argument generic:

```typescript
// Before — Vitest v2 syntax
const mockResults = vi.fn<[], { symbol: string; name: string }[]>(() => []);

// After — Vitest v3 syntax
const mockResults = vi.fn<() => { symbol: string; name: string }[]>(() => []);
```

The rule is simple: **`vi.fn<Fn>()` takes a single type parameter that is the complete function signature, not a separated args/return pair.**

---

## Section: Implicit `any` in Server Components (Category 3 — 5 Errors)

### The Symptom

```
error TS7005: Variable 'strategies' implicitly has an 'any' type.
```

### The Root Cause

In the dashboard pages, variables declared with `let` inside try/catch blocks lose their inferred type:

```typescript
let strategies;       // ← TypeScript infers `any` — no initializer, no annotation
try {
  strategies = await getStrategies();
} catch {
  strategies = [];
}
```

TypeScript's `noImplicitAny` rule (enabled by strict mode) flags this because `strategies` has no type annotation and no initializer from which to infer a type.

### The Fix

```typescript
let strategies: StrategyWithRuns[] = [];
try {
  strategies = await getStrategies();
} catch {
  // keep empty array — variable already initialized
}
```

This eliminates the `any` inference by providing both a type annotation and a default value. The `catch` block no longer needs to reassign — the variable already has a safe default.

---

## Section: ESLint Warnings — Unused Imports and React Hooks Rules (Category 4 — 6 Issues)

### Unused Imports (3 files)

Three test files imported testing-library utilities that were used during initial development but removed during refactoring:

```typescript
// Before
import { render, screen, within } from "@testing-library/react";    // `within` unused
import { screen, fireEvent, waitFor } from "@testing-library/react"; // `waitFor` unused
import { render, screen, fireEvent, waitFor } from "...";           // `fireEvent` unused
```

**Fix:** Remove the unused names from the import destructure. ESLint's `no-unused-vars` catches these.

### The `require()` in a vi.mock (1 file)

```typescript
vi.mock("recharts", () => {
  const React = require("react");  // ← ESLint: @typescript-eslint/no-require-imports
  // ...
});
```

Inside a `vi.mock()` factory function, you can't use top-level `import` statements because the mock factory runs in a special Vitest scope. Using `require()` is the pragmatic solution. The fix is to suppress the ESLint rule for that line:

```typescript
vi.mock("recharts", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
```

**Important:** The `eslint-disable` comment must be on the line *directly above* the violation, inside the function body — not above the `vi.mock()` call.

### The Stale Ref in useEffect Cleanup (1 file)

Already covered in Lesson 36 — the fix is to copy `ref.current` to a local variable before the cleanup closure captures it.

### The TanStack Table Incompatible Library Warning (1 file)

```
react-hooks/incompatible-library: useReactTable is from a library that is
not compatible with the react-hooks rules.
```

TanStack Table's `useReactTable` hook triggers a false positive in the React Hooks ESLint plugin because its internal implementation doesn't follow the standard hooks pattern exactly. Since TanStack Table is a well-maintained library and this is a known false positive, the correct fix is a targeted suppression:

```typescript
// eslint-disable-next-line react-hooks/incompatible-library
const table = useReactTable({
```

---

## Section: Missing shadcn/ui Components (Category 5 — Compilation Errors)

The optimization page imports `Alert` and `Skeleton` components that hadn't been installed:

```typescript
import { Alert, AlertDescription } from "@/components/ui/alert";     // ❌ File doesn't exist
import { Skeleton } from "@/components/ui/skeleton";                  // ❌ File doesn't exist
```

shadcn/ui components aren't npm packages — they're source files that get copied into your project. If you reference a component that hasn't been added, it's a missing file error, not a missing module error.

**Fix:**

```bash
npx shadcn@latest add alert skeleton --yes
```

This creates `components/ui/alert.tsx` and `components/ui/skeleton.tsx` with the full component source code.

---

## Section: The Validation Pipeline

After applying all fixes, we ran three validation steps in order:

```bash
# 1. Type check — 0 errors
npx tsc --noEmit

# 2. Lint check — 0 errors, 0 warnings
npx eslint .

# 3. Test suite — 397 passed, 0 failed
npx vitest run
```

Running them in this order matters:
- TypeScript catches type errors that would cascade into confusing test failures
- ESLint catches code quality issues that TypeScript ignores (unused imports, unsafe patterns)
- Tests verify that the fixes didn't change any runtime behavior

---

## Key Takeaway

> **Type errors in a growing codebase are compound interest on technical debt.** Each Prisma upgrade, each Vitest major version, each refactoring pass leaves behind small type holes that tests can't catch. Run `tsc --noEmit` and `eslint .` after every phase — not just the test suite — to catch problems before they multiply.

---

**Next:** Lesson 39 will cover Phase 10 — Real-Time SSE Streaming Integration.

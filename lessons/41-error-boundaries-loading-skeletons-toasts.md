# Lesson 41 — Error Boundaries, Loading Skeletons, and Toast Notifications

Every application eventually fails — a network request times out, a server returns 500, a user submits invalid data. The difference between a frustrating app and a polished one is how it *communicates* those failures. This lesson covers three complementary UI patterns we added in Phase 11: error boundaries that catch rendering crashes, loading skeletons that eliminate layout shift, and toast notifications that provide non-blocking feedback.

---

## Section: Next.js Error Boundaries

### The Concept

React error boundaries catch JavaScript errors during rendering and display a fallback UI instead of a white screen. Next.js integrates this pattern directly into the App Router: any file named `error.tsx` in a route segment acts as an error boundary for that segment and its children.

The hierarchy works like CSS specificity — the *closest* `error.tsx` to the crash handles it:

```
app/
├── error.tsx                       ← catches anything not caught below
├── dashboard/
│   ├── error.tsx                   ← catches dashboard-level errors
│   ├── results/
│   │   └── [id]/
│   │       └── error.tsx           ← catches results page errors
│   └── compare/
│       └── error.tsx               ← catches comparison page errors
```

Before Phase 11, we had error boundaries for `dashboard/`, `results/[id]/`, `compare/`, and `optimize/[id]/` — but **no root-level `error.tsx`**. If an error occurred outside the dashboard (e.g., in a provider or the root layout's children), the user would see the default Next.js error page or a blank screen.

### The Implementation

```tsx
// app/error.tsx
"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

Key details:

| Line | Why |
|---|---|
| `"use client"` | Error boundaries **must** be client components — React's `componentDidCatch` lifecycle requires client-side JavaScript |
| `error.message \|\| "An unexpected error occurred."` | Defensive fallback — some errors arrive with an empty message string |
| `reset: () => void` | Next.js injects this — calling it re-renders the route segment, giving the user a way to retry without a full page reload |
| `error: Error & { digest?: string }` | Next.js adds a `digest` property for production error tracking; we type it but don't display it to the user |

### Why We Made This Choice

**Alternative: `global-error.tsx`**

Next.js also offers `app/global-error.tsx`, which wraps the *entire* root layout — including `<html>` and `<body>`. This is the true last-resort boundary. However, it replaces the entire page structure, meaning your layout, theme provider, and font configuration all disappear. Using `app/error.tsx` instead preserves the root layout while still catching any unhandled error in the page tree. In practice, `global-error.tsx` is only needed when the root layout itself throws — a rare scenario.

---

## Section: Loading Skeletons

### The Concept

When a page fetches data server-side, Next.js shows a `loading.tsx` file as a fallback while the Server Component suspends. Without it, the user sees the previous page frozen in place with no indication that navigation has occurred. Skeletons solve this by rendering a grey placeholder that matches the eventual layout — eliminating the jarring "content pop" effect known as Cumulative Layout Shift (CLS).

### The Implementation

The strategy builder form (`/dashboard/new`) has a complex layout: header, name field, ticker search, date range (2 columns), strategy type cards (3 columns), parameters, risk settings, and a run button. The skeleton mirrors this:

```tsx
// app/dashboard/new/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function NewBacktestLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>

      {/* Date Range — matches the form's 2-column grid */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Strategy Type — matches the form's 3-column card grid */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
      {/* ... risk settings, run button ... */}
    </div>
  );
}
```

The critical principle: **the skeleton's grid breakpoints must match the real page**. If the form uses `sm:grid-cols-2` for date pickers and `lg:grid-cols-3` for strategy cards, the skeleton must use the same classes. Otherwise, the layout "jumps" when the real content replaces the skeleton.

### The Mental Model

Think of a skeleton as a contract between the loading state and the loaded state:

```
Loading:   [████████] [████████]     ← sm:grid-cols-2
Loaded:    [Jan 2024 ] [Dec 2024]    ← sm:grid-cols-2  ✓ no shift
```

If the skeleton used a single column but the loaded form used two, the user would see the layout snap sideways — defeating the skeleton's purpose.

---

## Section: Toast Notifications with Sonner

### The Concept

Toasts are transient, non-blocking messages that appear (typically in a corner) and auto-dismiss. They're the correct UI pattern for events the user should *notice* but doesn't need to *act on immediately*: "Backtest completed", "Experiment saved", "Validation failed."

We use [Sonner](https://sonner.emilkowal.dev/) via shadcn/ui's `<Toaster />` component, which was already in the root layout but never called anywhere except the delete confirmation flow.

### Where We Added Toasts

```
┌─────────────────────────────────┬──────────────────────────────────────────┐
│ Location                        │ Toast calls                              │
├─────────────────────────────────┼──────────────────────────────────────────┤
│ strategy-builder-form.tsx       │ toast.error("Please fix the             │
│                                 │   validation errors below")              │
├─────────────────────────────────┼──────────────────────────────────────────┤
│ save-experiment-dialog.tsx      │ toast.success("Experiment saved")        │
│                                 │ toast.error(errorMsg)                    │
├─────────────────────────────────┼──────────────────────────────────────────┤
│ useBacktestStream.ts            │ toast.success("Backtest completed")      │
│                                 │ toast.error(data.message)                │
├─────────────────────────────────┼──────────────────────────────────────────┤
│ useOptimizeStream.ts            │ toast.success("Optimization completed")  │
│                                 │ toast.error(data.message ?? "...")        │
└─────────────────────────────────┴──────────────────────────────────────────┘
```

### The Implementation Pattern

The toast integration is deliberately minimal — one import and one function call:

```typescript
// hooks/useBacktestStream.ts
import { toast } from "sonner";

// Inside the SSE message handler:
case "complete":
  dispatch(setResults(data.results));
  dispatch(setStatus("completed"));
  dispatch(setProgress(100));
  toast.success("Backtest completed");   // ← one line
  es.close();
  break;

case "error":
  dispatch(setError(data.message));
  dispatch(setStatus("failed"));
  toast.error(data.message);             // ← one line
  es.close();
  break;
```

### Why We Made This Choice

**Alternative: Redux-driven notification state**

A common pattern is to store notifications in a Redux slice — `notificationsSlice` with `addNotification` / `removeNotification` — and render them from a global `<NotificationList>` component. This gives you full control: persistent notifications, undo actions, notification history.

We rejected this because:
1. **All our toasts are fire-and-forget.** We never need to reference, query, or undo them.
2. **Sonner already handles queuing, animation, and auto-dismiss.** Reimplementing that in Redux would duplicate built-in functionality.
3. **The `toast()` API is callable from anywhere** — hooks, server action callbacks, event handlers — without needing access to the Redux dispatch function.

The guiding rule: use Redux for *state your UI renders from*; use Sonner for *ephemeral feedback*.

---

## Section: Testing These Patterns

### Error Boundary Tests

The key challenge: error boundary components receive `error` and `reset` as props, so they can be tested directly as regular components:

```tsx
it("calls reset when 'Try again' is clicked", async () => {
  const user = userEvent.setup();
  const reset = vi.fn();
  const error = Object.assign(new Error("fail"), { digest: undefined });
  render(<GlobalError error={error} reset={reset} />);
  await user.click(screen.getByRole("button", { name: /try again/i }));
  expect(reset).toHaveBeenCalledOnce();
});
```

Note the `Object.assign(new Error("fail"), { digest: undefined })` — we can't just pass `new Error("fail")` because TypeScript expects the `digest` property from Next.js's error type.

### Loading Skeleton Tests

Skeleton tests verify *structure*, not visual appearance:

```tsx
it("has responsive date range grid", () => {
  const { container } = render(<NewBacktestLoading />);
  const grids = container.querySelectorAll(".sm\\:grid-cols-2");
  expect(grids.length).toBeGreaterThanOrEqual(1);
});
```

We query for CSS class names (escaped with `\\:` for the Tailwind colon) because that's the contract between the skeleton and the real form. If someone changes the form to 3 columns, this test will remind them to update the skeleton.

### Toast Tests

Toasts are tested by mocking the entire `sonner` module:

```tsx
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Later:
expect(toast.error).toHaveBeenCalledWith(
  "Please fix the validation errors below"
);
```

This works because `toast.success()` and `toast.error()` are side effects — they don't return UI; they trigger the global `<Toaster />`. By mocking them, we verify the call happened without needing to render Sonner's toast container.

---

## Key Takeaway

> Error boundaries, loading skeletons, and toast notifications form a **feedback triad** — boundaries handle catastrophic rendering failures, skeletons handle expected wait times, and toasts handle transient operational events. Together they ensure the user is never left wondering "is the app broken, loading, or did something happen?"

---

**Next:** [Lesson 42 — Cross-Stack Validation with Zod and Pydantic](./42-cross-stack-validation-zod-pydantic.md)

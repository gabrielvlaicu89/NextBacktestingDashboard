# Lesson 24 — Component Testing with Testing Library: The Class Token Pitfall

React Testing Library (RTL) is purpose-built for testing components the way users interact
with them: finding elements by role, text, and label rather than internal implementation
details. But CSS-class-based assertions are a necessary part of testing visual states like
"active" links. This lesson covers how to test component behaviour with RTL, how to mock
Next.js and next-themes in a Vitest environment, and — most importantly — the exact false-
positive bug we hit when testing active nav link classes, and the mental model that prevents
it.

---

## Section: The Test Environment

Frontend tests run under Vitest with jsdom as the DOM implementation. Because Next.js
components import Next.js-specific modules (`next/navigation`, `next/link`, `next-auth/react`,
`next-themes`), those modules must be mocked in the test environment — they'd crash or
behave unexpectedly if imported directly into jsdom.

```
Vitest (test runner)
  └── jsdom (simulates browser DOM)
       └── @testing-library/react (renders components into jsdom)
            └── Mocked modules:
                 ├── next/navigation → { usePathname: vi.fn() }
                 ├── next/link       → plain <a> tag
                 ├── next-auth/react → { signOut: vi.fn() }
                 └── next-themes     → { useTheme: vi.fn() }
```

Each mock replaces an entire module's exports with test-controlled values. They're placed
at the top of the test file, outside any `describe` block, so vitest can hoist them before
the module under test is imported:

```typescript
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
```

`next/link` is mocked as a plain `<a>` element because jsdom can't simulate Next.js client-
side navigation. By rendering it as an `<a>`, the RTL `getByRole("link")` and `getByText()`
queries work correctly.

`usePathname` is mocked as a function that calls `mockPathname()` — a `vi.fn()` that can
return different values per test:

```typescript
const mockPathname = vi.fn(() => "/dashboard");

beforeEach(() => {
  mockPathname.mockReturnValue("/dashboard");  // reset to default before each test
});

it("highlights New Backtest when on /dashboard/new", () => {
  mockPathname.mockReturnValue("/dashboard/new");  // override for this test
  render(<AppSidebar user={mockUser} />);
  ...
});
```

---

## Section: What We Were Testing

`AppSidebar` sets an active link style using `cn()` with a conditional:

```typescript
className={cn(
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
  isActive
    ? "bg-sidebar-accent text-sidebar-accent-foreground"                          // active
    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"  // inactive
)}
```

When `isActive` is true, `bg-sidebar-accent` is applied.
When `isActive` is false, `hover:bg-sidebar-accent/50` is applied.

The tests needed to verify both states — that the active link has the class, and that an
inactive link does not.

---

## Section: The Bug — A False Positive from Substring Matching

We wrote this test for the inactive Dashboard link when navigating to `/dashboard/new`:

```typescript
it("does NOT highlight Dashboard when pathname is /dashboard/new", () => {
  mockPathname.mockReturnValue("/dashboard/new");
  render(<AppSidebar user={mockUser} />);
  const link = screen.getByText("Dashboard").closest("a");
  expect(link?.className).not.toContain("bg-sidebar-accent");  // ← BUG
});
```

Running `npx vitest run` produced this failure:

```
AssertionError: expected 'flex items-center gap-3 rounded-md px…' not to contain 'bg-sidebar-accent'

Expected: "bg-sidebar-accent"
Received: "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
          text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
```

The test was asserting that the string `"bg-sidebar-accent"` is **not** a substring of the
className string. But the inactive class `hover:bg-sidebar-accent/50` contains
`bg-sidebar-accent` as a literal substring:

```
"hover:bg-sidebar-accent/50"
       ^^^^^^^^^^^^^^^^^^^ this is a substring of the whole class name
```

So `.not.toContain("bg-sidebar-accent")` was failing even though the link was correctly
inactive. The test had a **false positive** — it was failing even when the component
behaviour was correct.

### Why This Is Dangerous

A false positive in a negative assertion (`not.toContain`) is particularly insidious:
- The component is working correctly
- The test is saying it's broken
- A developer might "fix" the component to make the test pass — breaking the real behaviour
- Or they might disable the test, losing coverage

In this case, the test was wrong. The component was right.

---

## Section: The Root Cause and Fix

The root cause is that `.toContain()` on a string does **substring matching**, not
**word/token matching**. CSS class names are space-separated tokens, not a single string.
Treating the className as a string rather than a list of tokens is the wrong abstraction.

**The fix**: split the className into an array of tokens and use `.toContain()` on the
array instead of the string. Array `.toContain()` checks for exact element equality.

```typescript
it("does NOT highlight Dashboard when pathname is /dashboard/new", () => {
  mockPathname.mockReturnValue("/dashboard/new");
  render(<AppSidebar user={mockUser} />);
  const link = screen.getByText("Dashboard").closest("a");
  const classes = link?.className.split(/\s+/) ?? [];   // ① split into tokens
  expect(classes).not.toContain("bg-sidebar-accent");   // ② exact token match
});
```

**① `split(/\s+/)`** — Regular expression `\s+` splits on one or more whitespace characters
(space, tab, newline). This correctly handles multiple consecutive spaces and is more robust
than `split(" ")`.

**② Array `.toContain()` checks exact token equality** — `"bg-sidebar-accent"` is not
equal to `"hover:bg-sidebar-accent/50"`. The assertion correctly passes when the link is
inactive.

### Consistent token matching for the positive assertions

The positive assertions (checking that active links DO have the class) also use string
`.toContain()`, but they happen to be correct — because `bg-sidebar-accent` as a substring
of `bg-sidebar-accent` is exact anyway. For absolute consistency, they could also use the
array approach:

```typescript
// Using string.toContain — works but fragile
expect(link?.className).toContain("bg-sidebar-accent");

// Using array.toContain — explicit and immune to substring issues
const classes = link?.className.split(/\s+/) ?? [];
expect(classes).toContain("bg-sidebar-accent");
```

Adopting the array form for all class assertions is the safer standard.

---

## Section: Alternative Assertions — Why We Don't Use `toHaveClass`

Testing Library provides a `toHaveClass()` matcher from `@testing-library/jest-dom`:

```typescript
expect(link).toHaveClass("bg-sidebar-accent");
expect(link).not.toHaveClass("bg-sidebar-accent");
```

`toHaveClass()` already handles the token-splitting correctly — it checks for exact class
name tokens, not substrings. This bug would never have occurred with `toHaveClass`.

We used manual `className.split(/\s+/)` in this project because `@testing-library/jest-dom`
required a setup file to register its matchers (`vitest.setup.ts` with the import), and this
was added after the initial tests were written. The fix worked in both directions — either
adopt `toHaveClass()` or switch to array-based assertions.

Either is correct. The key insight is the same: **CSS class names are tokens, not a
string.**

---

## Section: Testing Component Behaviour vs Styling

A broader question: should tests assert on CSS classes at all?

RTL's guiding principle is to test component behaviour, not implementation. Checking
`className` values is a form of implementation testing — it ties tests to styling decisions.
If the active class name ever changes from `bg-sidebar-accent` to `data-active`,
the tests break even though the behaviour is unchanged.

Alternatives:

| Approach | Pro | Con |
|---|---|---|
| `className` assertion | Tests actual visual output | Brittle to style changes |
| `aria-current="page"` attribute | Standard web accessibility primitive | Requires adding `aria-current` to the component |
| `data-active` attribute | Explicit test handle | Non-semantic, test-only attribute |
| Visual regression testing | Tests actual rendered pixels | Requires screenshot infrastructure |

For this project, `className` assertions are a pragmatic choice — the class names are
design tokens (`bg-sidebar-accent`) tied to a design system, not arbitrary hex values that
change frequently. But the right long-term solution is:

```typescript
// In AppSidebar
<Link
  aria-current={isActive ? "page" : undefined}   // ← standard semantic attribute
  ...
>

// In the test
expect(link).toHaveAttribute("aria-current", "page");        // active
expect(link).not.toHaveAttribute("aria-current");            // inactive
```

`aria-current="page"` is the HTML standard for marking the current page link. It's
semantically meaningful, tested by accessibility audits, and doesn't change when you
redesign the sidebar.

---

## Key Takeaway

> `.toContain()` on a class string does substring matching — `"hover:bg-sidebar-accent/50"` contains `"bg-sidebar-accent"` as a substring, causing false positives in negative assertions. Always split `className` into tokens with `.split(/\s+/)` before asserting, or use `toHaveClass()` from `@testing-library/jest-dom`. Better yet, use semantic HTML attributes like `aria-current="page"` so tests aren't coupled to CSS class names at all.

---

**Next:** [Lesson 25 — Catalog-Driven Dynamic Forms](./25-catalog-driven-dynamic-forms.md)

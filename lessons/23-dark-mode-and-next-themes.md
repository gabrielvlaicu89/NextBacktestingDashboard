# Lesson 23 — Dark Mode with next-themes: Hydration, ThemeProvider, and `suppressHydrationWarning`

Dark mode sounds simple — toggle a CSS class. But in a server-rendered app, it's subtly
hard: the server doesn't know what the user's theme preference is when it generates HTML.
This mismatch between server and client output causes a React error called a hydration
mismatch. This lesson explains why the mismatch happens and exactly what `next-themes` —
and `suppressHydrationWarning` — do to fix it.

---

## Section: Why Dark Mode Is Hard on the Server

In a classic client-side app, dark mode is trivial:
1. Read `localStorage.getItem("theme")` on load
2. Toggle `document.documentElement.classList.add("dark")`

In Next.js, the server renders HTML before any JavaScript runs. The server has no access to
`localStorage`, no browser, and no knowledge of the user's OS colour preference or saved
setting. So the server always renders the same HTML.

When React "hydrates" — attaches event listeners and reconciles the server HTML with the
client-side virtual DOM — it compares the two outputs byte-for-byte. If they differ, React
throws:

```
Warning: Prop `className` did not match.
  Server: "light"
  Client: "dark"
```

This causes a full re-render on the client, discarding the server HTML. Even worse, it can
cause a flash of the wrong theme.

---

## Section: The `next-themes` Strategy

`next-themes` solves the problem by modifying the `<html>` element's `class` attribute to
store the active theme. The key insight is:

> Don't render any theme-dependent content during the initial hydration pass. Let the theme
> settle after the first client-side render.

`next-themes` does this by injecting a tiny inline `<script>` into the `<head>` that reads
`localStorage` and applies the class to `<html>` **before** React hydrates. This runs
synchronously before the browser paints, eliminating the flash.

The `attribute="class"` setting tells `next-themes` to manage the theme via the CSS class
on `<html>`:

```
No preference     → <html>          (no class)
Light mode        → <html class="light">
Dark mode         → <html class="dark">
```

Our Tailwind config (via `globals.css`) uses `@custom-variant dark (&:is(.dark *))`, which
generates dark: utility classes that activate when an ancestor has the `dark` class. This
is the class strategy — as opposed to the `media` strategy which uses the OS `prefers-color-scheme`
media query and doesn't support user toggles.

---

## Section: The Implementation

```typescript
// components/providers/theme-provider.tsx

"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

This is a thin wrapper that re-exports `next-themes`' `ThemeProvider` as a named
`"use client"` component. The reason for the wrapper is that `next-themes`' own package
doesn't mark itself as a client component — it needs to be wrapped in a `"use client"`
boundary so it can be imported into the server-side `app/layout.tsx`.

It's wired into the root layout:

```typescript
// app/layout.tsx

  return (
    <html lang="en" suppressHydrationWarning>  {/* ① */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"            {/* ② manage via CSS class */}
          defaultTheme="system"        {/* ③ follow OS preference by default */}
          enableSystem                 {/* ④ allow system preference detection */}
          disableTransitionOnChange    {/* ⑤ prevent flash of transition on load */}
        >
          <SessionProvider session={session}>
            <ReduxProvider>
              {children}
            </ReduxProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
```

---

## Section: `suppressHydrationWarning` — What It Does and Why It Goes on `<html>`

### The warning

Even with `next-themes` injecting a script before React hydrates, there will still be a
React warning. Here's why:

The server renders:

```html
<html lang="en">
```

The `next-themes` inline script then sets:

```html
<html lang="en" class="dark">
```

When React hydrates, it sees `<html lang="en">` in the server HTML, but the DOM now has
`<html lang="en" class="dark">`. These don't match. React warns.

`suppressHydrationWarning` tells React: "I know this element's attributes may not match
between server and client. Don't warn, and don't re-render." It's a targeted escape hatch
for exactly this scenario.

```typescript
<html lang="en" suppressHydrationWarning>
```

**It goes on `<html>`, not `<body` or the ThemeProvider** — because that's the element
whose attributes are being modified by the injected script. If placed elsewhere, the warning
would still appear.

### Why this is safe here

`suppressHydrationWarning` is generally a red flag — suppressing warnings without fixing
root causes leads to hard-to-debug inconsistencies. Here it's justified because:

1. The `class` attribute on `<html>` is only used for dark mode CSS. It has no bearing on
   anything React renders — it's purely styling.
2. The transition happens in a single synchronous frame before the first paint, so users
   never see the wrong theme.
3. It's scoped to exactly one attribute on one element; it doesn't propagate to children.

The official `next-themes` documentation explicitly recommends this pattern.

---

## Section: The ThemeToggle Component

```typescript
// components/layout/theme-toggle.tsx

"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

**`resolvedTheme` vs `theme`** — `theme` is the stored value, which could be `"system"`.
`resolvedTheme` is the actual colour (`"light"` or `"dark"`) resolved from the OS preference
when `theme === "system"`. Always use `resolvedTheme` for conditional rendering logic.

**Both icons always in the DOM** — Sun and Moon are both rendered at all times. CSS
transitions animate between them using `scale-0`/`scale-100` and rotation. This is
intentional: React would cause a flash if it unmounted and remounted icons based on the
theme, because the very first render might be on the wrong theme.

```
Light mode: Sun  scale-100 rotate-0   (visible, no rotation)
            Moon scale-0   rotate-90   (hidden, rotated away)

Dark mode:  Sun  scale-0   rotate-90  (hidden via dark:scale-0 dark:-rotate-90)
            Moon scale-100 rotate-0   (visible via dark:scale-100 dark:rotate-0)
```

---

## Section: CSS Variables vs Class Names for Theming

Tailwind's built-in `dark:` prefix could apply different literal colour values in dark mode:

```html
<div class="bg-white dark:bg-zinc-900">
```

We instead use CSS custom properties (variables) defined in `globals.css`:

```css
:root {
  --background: oklch(1 0 0);        /* white */
  --foreground: oklch(0.145 0 0);    /* near-black */
}

.dark {
  --background: oklch(0.145 0 0);    /* near-black */
  --foreground: oklch(0.985 0 0);    /* near-white */
}
```

Then Tailwind utilities reference the variable:

```html
<div class="bg-background text-foreground">  <!-- always the same class -->
```

| Approach | Classes needed | Dark mode change |
|---|---|---|
| `dark:` prefix | `bg-white dark:bg-zinc-900` | 2× number of classes everywhere |
| CSS variables | `bg-background` | Zero class changes — value changes |

The CSS variable approach keeps components clean: a component uses `bg-card`, `text-foreground`,
`border-border` — none of which mention "light" or "dark". This makes it trivial to create
additional themes (e.g., high-contrast, sepia) by adding a new CSS class with the same
variable names set to new values, without touching any component code.

The oklch colour space used in the CSS values is a perceptual colour model where equal
numeric changes produce perceptually equal changes in lightness. It produces more predictable
and accessible palettes than hex values.

---

## Key Takeaway

> Server-rendered dark mode requires an inline script to set the theme class before React hydrates. Use `suppressHydrationWarning` on `<html>` to silence the expected class mismatch, and always read `resolvedTheme` (not `theme`) when resolving "system" preference to an actual colour. Prefer CSS variables over `dark:` class prefixes to keep component markup theme-agnostic.

---

**Next:** [Lesson 24 — Component Testing with Testing Library: The Class Token Pitfall](./24-component-testing-class-tokens.md)

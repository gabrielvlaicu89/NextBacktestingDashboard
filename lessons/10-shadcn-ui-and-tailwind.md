# Lesson 10 — shadcn/ui & Tailwind CSS

## Utility-First CSS: The Tailwind Philosophy

Traditional CSS involves writing class names and then writing CSS rules for them:

```css
/* style.css */
.card {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

```html
<div class="card">...</div>
```

Tailwind inverts this: you compose styles directly in your HTML using small single-purpose utility classes:

```html
<div class="bg-white rounded-lg p-4 shadow-sm">...</div>
```

There is no separate CSS file to maintain. The style is co-located with the markup.

### The Mental Shift

This feels wrong at first. "Isn't that inline styles?" It's similar, but with two critical differences:
1. You're working with a **design system** (Tailwind's spacing scale, color palette, shadow tokens) rather than arbitrary pixel values.
2. Tailwind classes support responsive variants, dark mode, and hover states that inline styles cannot:

```html
<div class="p-4 md:p-8 dark:bg-slate-900 hover:bg-slate-100">
```

### Why Tailwind Works at Scale

- **No dead CSS.** Tailwind scans your source files and includes only the classes you actually use. CSS bundle is tiny.
- **No naming decisions.** "Should this be `.card`, `.panel`, `.surface`?" — with Tailwind, you don't name things. You just describe them.
- **Consistency by default.** `p-4` is always `1rem`. It's impossible to accidentally use `padding: 17px` somewhere inconsistent.

## Tailwind v4 — What Changed

Our project uses Tailwind v4, which is a significant rewrite. Key differences from v3:

**1. No `tailwind.config.js`.** Configuration moves into your CSS file:

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-brand: oklch(0.6 0.2 260);
  --font-sans: "Inter", sans-serif;
}
```

**2. CSS variables everywhere.** Design tokens are now CSS custom properties, making them accessible in both Tailwind classes and raw CSS.

**3. `@apply` still works** but is discouraged in v4. The preference is always composition at the component level.

**4. Automatic content detection.** You no longer need to configure `content: [...]`. Tailwind v4 scans your project automatically.

## shadcn/ui — Components You Own

shadcn/ui is not a traditional component library. This distinction is crucial.

### Traditional Component Library

```bash
npm install @mui/material
```

You import components:
```ts
import { Button } from "@mui/material"
```

The component code lives in `node_modules`. You can't edit it. If the default behavior doesn't suit you, you override it with CSS. If the API doesn't expose the control you need, you're blocked.

### The shadcn/ui Approach

```bash
npx shadcn@latest add button
```

This copies the component's source code into your project:
```
frontend/components/ui/button.tsx   ← you own this file
```

You can read it, understand it, and modify it freely. It's not a dependency — it's your code.

```ts
// components/ui/button.tsx — you can edit this directly
const buttonVariants = cva(
  "inline-flex items-center justify-center ...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground ...",
        // Add your own variant here:
        brand: "bg-brand text-white hover:bg-brand/90",
      },
    },
  }
)
```

### The Components Are Built on Radix UI

shadcn/ui components are wrappers around **Radix UI** primitives. Radix handles all the hard accessibility concerns:
- Keyboard navigation (arrow keys in dropdowns, Tab/Shift+Tab)
- ARIA attributes
- Focus management
- Screen reader announcements

shadcn/ui layers Tailwind styling on top. You get accessible, styled components — and you own the code.

## `components.json` — The shadcn Configuration

Running `npx shadcn@latest init` created this file:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

This file tells the `shadcn` CLI:
- Where to write component files (`@/components`)
- Where your global CSS is
- Whether to use CSS variables for theming
- Your base color palette

When you run `npx shadcn@latest add card` later, it reads this config to know where to put the file and how to style it.

## `lib/utils.ts` — The `cn()` Helper

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

This small utility is used everywhere in shadcn components. It solves two problems:

**`clsx`** handles conditional class names:
```ts
clsx("p-4", isActive && "bg-blue-500", { "opacity-50": isDisabled })
// → "p-4 bg-blue-500 opacity-50" (only includes truthy classes)
```

**`twMerge`** resolves Tailwind class conflicts:
```ts
twMerge("p-4 p-8")          // → "p-8" (last wins, correctly)
twMerge("px-4 p-8")         // → "p-8" (p-8 overrides px-4, correctly)
```

Without `twMerge`, if a component has `p-4` and the caller passes `p-8` to override it, both classes exist in the DOM and the winner is determined by CSS specificity (unpredictable). `twMerge` understands Tailwind's class hierarchy and keeps only the winning class.

Usage in components:

```ts
function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn("px-4 py-2 rounded bg-primary", className)}
      {...props}
    />
  )
}
```

The caller can override any class and it Just Works.

## CSS Variables for Theming

shadcn/ui uses CSS variables to define the color system:

```css
/* globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 47.4% 11.2%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... */
}

.dark {
  --background: 224 71% 4%;
  --foreground: 213 31% 91%;
  /* ... */
}
```

These variables are referenced by Tailwind classes like `bg-primary`, `text-foreground`. Switching to dark mode is just toggling a CSS class — no JavaScript needed to recompute styles. `next-themes` handles this toggle.

## The Full Component Pipeline

```
Radix UI Primitive        ← Accessibility (focus, ARIA, keyboard)
       ↓
shadcn/ui Component       ← Tailwind styling + variants
       ↓
Your Component            ← Business logic, cn() customizations
       ↓
Page                      ← Composition
```

## Adding a Component

```bash
# From frontend/
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add select
```

Each command copies the component source into `components/ui/`. No npm install needed afterward — the component is already in your codebase.

## Key Takeaway

> Tailwind's utility classes eliminate the naming and specificity battles of traditional CSS, while enforcing design system constraints. shadcn/ui gives you accessible, production-quality components that you fully own — no version-locked black boxes. The combination is the fastest path from design to working UI with maintainable code.

---

**Congratulations — you've completed all 10 Phase 1 lessons!**

## Lesson Summary

| # | Topic | Core Concept |
|---|-------|-------------|
| 01 | Monorepo & Structure | Organizing frontend + backend in one git repo |
| 02 | Next.js App Router | File-based routing, Server vs Client Components |
| 03 | TypeScript & tsconfig | Type safety, path aliases, strict mode |
| 04 | Prisma & Database | ORM, schema-first modeling, migrations |
| 05 | FastAPI & Python Backend | Async API, Pydantic v2, SSE streaming |
| 06 | Strategy Engine | Abstract classes, factory pattern, Template Method |
| 07 | Authentication | NextAuth v4, OAuth flow, Prisma adapter |
| 08 | Environment Variables | Security, .env files, NEXT_PUBLIC_ prefix |
| 09 | Docker & Dev Setup | Containers, docker-compose, bind mounts |
| 10 | shadcn/ui & Tailwind | Utility CSS, owned components, cn() helper |

Ready for Phase 2: Authentication Implementation.

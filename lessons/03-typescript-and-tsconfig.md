# Lesson 03 — TypeScript & tsconfig

## Why TypeScript?

TypeScript is JavaScript with a type system bolted on. The source files (`.ts`, `.tsx`) get compiled to plain JavaScript before running — the browser never sees TypeScript directly.

**The case for using it in this project:**

This app involves many data shapes that need to stay in sync between components:
- A `BacktestRun` record in Postgres must match the `BacktestResponse` shape returned by the Python API
- The form in the Strategy Builder must produce exactly the shape that the API route expects
- The equity curve data from Python must match what the chart component accepts

Without TypeScript, these mismatches silently become runtime bugs. With TypeScript, they become compile-time errors that you catch immediately.

```ts
// Without TypeScript — you have no idea what `run.results` looks like
const totalReturn = run.results.metrics.totalReturn // typo? wrong key? find out at runtime

// With TypeScript — the compiler knows the exact shape
const totalReturn = run.results.metrics.total_return_pct // type error if key doesn't exist
```

## The `tsconfig.json` — What Each Option Does

```jsonc
{
  "compilerOptions": {
    "target": "ES2017",         // compile to this JS version (broad browser support)
    "lib": ["dom", "esnext"],   // available browser/JS APIs (dom = window, document…)
    "allowJs": true,            // allow .js files alongside .ts (for gradual migration)
    "skipLibCheck": true,       // skip type-checking declaration files (speeds up builds)
    "strict": true,             // enable all strict checks (recommended — see below)
    "noEmit": true,             // don't produce .js files (Next.js does that via Webpack/Turbopack)
    "esModuleInterop": true,    // allow `import x from 'x'` for CommonJS modules
    "module": "esnext",         // use ES module syntax (import/export, not require)
    "moduleResolution": "bundler", // how to resolve imports (tailored for bundlers like Webpack)
    "resolveJsonModule": true,  // allow `import data from './data.json'`
    "isolatedModules": true,    // each file must be independently compilable (Next.js needs this)
    "jsx": "react-jsx",         // transform <JSX /> automatically (no need to `import React`)
    "incremental": true,        // cache build info to speed up subsequent compilations
  }
}
```

### `"strict": true` — What It Enables

This single option turns on a bundle of strict checks. The most important ones:

- **`strictNullChecks`** — `string` and `string | null` are different types. You must explicitly handle `null`/`undefined`.
- **`noImplicitAny`** — every value must have a known type; no silent `any`.
- **`strictFunctionTypes`** — function parameter types are checked contravariantly.

Think of `strict: true` as saying "I want TypeScript to be a strict teacher, not a permissive one."

## Path Aliases

Our `tsconfig.json` defines these aliases:

```jsonc
"paths": {
  "@/*":             ["./*"],
  "@/components/*":  ["./components/*"],
  "@/lib/*":         ["./lib/*"],
  "@/store/*":       ["./store/*"],
  "@/hooks/*":       ["./hooks/*"],
  "@/types/*":       ["./types/*"]
}
```

Without aliases, deeply nested components would need relative imports like:

```ts
import { Button } from "../../../components/ui/button"  // fragile, ugly
```

With aliases:

```ts
import { Button } from "@/components/ui/button"          // clear, stable
```

The alias always resolves relative to the root of `frontend/`, regardless of where the importing file lives. If you move a file to a different directory, the import doesn't break.

**Important:** The `@/*` alias (set by `create-next-app`) already covers everything. The more specific aliases (`@/components/*`, `@/lib/*`, etc.) are redundant but serve as documentation — they make explicit which top-level directories are intended to hold what kind of code.

## The `next-env.d.ts` File

You'll see this file in the frontend root. Don't touch it — Next.js auto-generates and manages it. It adds TypeScript declarations for Next.js-specific types (like image imports, CSS modules, etc.).

## TypeScript in This Project's Stack

| Layer | Language | Why |
|---|---|---|
| Next.js pages, components, API routes | TypeScript (`.ts`, `.tsx`) | Type safety across the whole frontend |
| Prisma schema | Prisma DSL (generates TypeScript) | Prisma auto-generates typed client from the schema |
| FastAPI backend | Python + Pydantic | Python's equivalent of TypeScript types for APIs |
| Validation | zod | Runtime schema validation that also generates TypeScript types |

### zod + TypeScript: the best of both worlds

TypeScript types only exist at compile time — they disappear at runtime. `zod` schemas validate data at runtime AND generate TypeScript types:

```ts
import { z } from "zod"

const BacktestRequestSchema = z.object({
  ticker: z.string().min(1),
  dateFrom: z.string().date(),
  capital: z.number().positive(),
})

// Infer the TypeScript type FROM the zod schema — single source of truth
type BacktestRequest = z.infer<typeof BacktestRequestSchema>

// At runtime: validate incoming form data
const result = BacktestRequestSchema.safeParse(formData)
if (!result.success) {
  // result.error.errors tells you exactly what's wrong
}
```

## Key Takeaway

> TypeScript's value is **not** just catching bugs — it's making refactoring safe. When you change the shape of your backtest results object, TypeScript will tell you every single place in the codebase that needs to be updated. In a project with this many interconnected data shapes, that's invaluable.

---

**Next:** [Lesson 04 — Prisma & Database Modeling](./04-prisma-and-database-modeling.md)

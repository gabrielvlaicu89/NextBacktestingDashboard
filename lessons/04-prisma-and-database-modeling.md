# Lesson 04 — Prisma & Database Modeling

## What is an ORM?

An ORM (Object-Relational Mapper) bridges two different worlds:

- **Relational databases** think in tables, rows, foreign keys, SQL
- **Your application** thinks in objects, classes, TypeScript types

Without an ORM, you'd write raw SQL strings — which work, but have no type safety, are easy to get wrong, and don't compose well. Prisma is a modern ORM for Node.js/TypeScript that generates a fully typed client directly from your schema.

```ts
// Without Prisma — raw SQL, no types
const runs = await db.query("SELECT * FROM backtest_runs WHERE user_id = $1", [userId])
// `runs` is `any[]` — no idea what shape it is

// With Prisma — fully typed
const runs = await prisma.backtestRun.findMany({ where: { userId } })
// `runs` is `BacktestRun[]` — TypeScript knows every field
```

## The Three-Part Prisma Setup

Our setup involves three files working together:

```
frontend/
├── prisma/
│   └── schema.prisma      ← 1. You define models here
├── prisma.config.ts        ← 2. Prisma CLI configuration
└── app/generated/prisma/   ← 3. Generated TypeScript client (don't edit!)
```

**1. `schema.prisma`** — your source of truth. You write models like `User`, `Strategy`.

**2. `prisma.config.ts`** — tells Prisma CLI how to connect to the database and where things live.

**3. `app/generated/prisma/`** — Prisma generates this from your schema. It contains the fully typed `PrismaClient` class. You import from here in your app code. **Never edit this folder manually.**

## The Schema: Dissecting Our Models

### Generator Block

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}
```

This tells Prisma: "when I run `prisma generate`, create a TypeScript client and put it in `app/generated/prisma/`". We've pointed it there rather than the default `node_modules` location so it's more visible.

### Datasource Block

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")     // pooled connection (runtime)
  directUrl = env("DIRECT_URL")       // direct connection (migrations)
}
```

Two connection strings — why?

- **`DATABASE_URL`** uses PgBouncer (Supabase's connection pooler). Pooling is essential in serverless environments (like Vercel) where hundreds of function invocations might each try to open a database connection. PgBouncer reuses connections, preventing your database from being overwhelmed.
- **`DIRECT_URL`** bypasses the pooler and connects directly. Prisma's migration tool needs this because it runs long-lived commands that don't work well through a pooler.

### Enums

```prisma
enum StrategyType {
  MEAN_REVERSION
  MA_CROSSOVER
  // ...
}
```

Enums are stored as strings in Postgres but the Prisma client treats them as TypeScript union types. Benefits:
- The database **rejects** any value not in the enum (data integrity at DB level)
- TypeScript **flags** any invalid assignment at compile time
- Your code is self-documenting — `StrategyType.MEAN_REVERSION` is more readable than `"mean_reversion"`

### The User Model and Relations

```prisma
model User {
  id       String @id @default(cuid())
  // ...
  strategies   Strategy[]
  backtestRuns BacktestRun[]
}
```

`Strategy[]` and `BacktestRun[]` are **relation fields** — they don't appear as columns in the database. They tell Prisma how to join tables so you can write:

```ts
const user = await prisma.user.findUnique({
  where: { id },
  include: { strategies: true }   // JOIN under the hood
})
// user.strategies is Strategy[] — fully typed
```

### `cuid()` vs `uuid()`

We use `@default(cuid())` for IDs. A CUID (Collision-Resistant Unique ID) looks like `clh3xkp0f0001...`. It's:
- **Sortable** — newer IDs sort later alphabetically (useful for pagination)
- **Collision-resistant** — safe to generate on the client if needed
- **URL-safe** — no special characters

UUIDs (`uuid()`) are also fine and more standard. CUIDs are a Prisma-flavored alternative.

### The `Json` Type — When to Use It

```prisma
model Strategy {
  parameters   Json
  riskSettings Json
}
```

We stored strategy parameters and risk settings as `Json` columns rather than individual columns. This was a deliberate trade-off:

**Why `Json`:**
- Strategy parameters differ per type (mean reversion has `zscore_window`, MA crossover has `fast_period`). Making individual columns for every possible parameter combination would require many nullable columns or a complex schema.
- Parameters are always read/written together, never queried individually.

**Why NOT `Json` (trade-off):**
- You can't filter or sort by fields inside a JSON column efficiently.
- No database-level type safety — anything can be stored there.

Rule of thumb: use `Json` for **opaque blobs** that your app reads/writes as a unit. Use individual columns for anything you need to filter, sort, or enforce constraints on.

### `onDelete: Cascade`

```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

This means: when a `User` is deleted, automatically delete all their `Strategy` records too. Without this, trying to delete a user who has strategies would throw a foreign key constraint error.

## The Prisma Workflow

```
Edit schema.prisma
       ↓
npx prisma migrate dev    ← creates SQL migration + applies it to DB
       ↓
npx prisma generate       ← regenerates the TypeScript client
       ↓
Import and use in code:
  import { prisma } from "@/lib/prisma"
  const strategies = await prisma.strategy.findMany()
```

`migrate dev` does two things at once: it creates a migration file (a SQL script that records the change) and applies it to the database. The migration files are committed to git — they're a history of every schema change.

## The `postinstall` Hook

In `package.json`:

```json
"scripts": {
  "postinstall": "prisma generate"
}
```

`postinstall` runs automatically after every `npm install`. This ensures the Prisma client is always regenerated when dependencies change — critical for deployment environments like Vercel that run `npm install` as part of the build process.

## Key Takeaway

> Prisma's schema is the **contract** between your application and the database. Get it right and everything downstream — TypeScript types, API responses, form validation — becomes easier to keep consistent. When you change the schema, Prisma makes it impossible to forget to update your application code.

---

**Next:** [Lesson 05 — FastAPI & the Python Backend](./05-fastapi-and-python-backend.md)

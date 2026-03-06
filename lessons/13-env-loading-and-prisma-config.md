# Lesson 13 — Environment Loading: Why `.env.local` Doesn't Just Work

During Phase 2 setup we ran into a specific problem: after correctly filling in our Supabase credentials, `npx prisma migrate dev` still connected to `localhost:5432` and failed. The credentials were in the right file but Prisma wasn't reading them. This lesson explains the root cause and the fix — and the general principle it illustrates.

---

## The Environment File Landscape in This Project

A Next.js project can have several environment files:

```
frontend/
├── .env              ← read by dotenv, Prisma CLI, and most Node tools
├── .env.local        ← read by Next.js (server + client); NOT read by Prisma CLI
└── .env.example      ← documentation; never read by any tool
```

**This is the critical point:**

> `.env.local` is a Next.js convention. The Prisma CLI is not a Next.js tool — it's a standalone Node.js program. It uses `dotenv` under the hood, which reads `.env` by default, not `.env.local`.

So we had our credentials in `.env.local` (correct for Next.js) but Prisma was reading `.env` (which had a stale `localhost:5432` default). The two files disagreed.

---

## Why We Put Credentials in `.env.local`

We stored all credentials in `.env.local` rather than `.env` for a deliberate reason: **`.env.local` is always gitignored by Next.js by default**.

`.env` is commonly committed to version control to document what variables are needed (with placeholder values). `.env.local` is the file that overrides `.env` with real values and is never committed. This distinction prevents secrets from accidentally landing in git history.

Using a single source of truth (`.env.local`) means:
- All real credentials are in one file
- That file is gitignored
- The committed `.env` file or `.env.example` contains only safe placeholder values

---

## The Broken `prisma.config.ts`

The auto-generated `prisma.config.ts` used `import "dotenv/config"`, which loads `.env`:

```ts
import "dotenv/config";           // ← reads .env only
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),     // ← picks up the WRONG DATABASE_URL
  },
});
```

So even though `DATABASE_URL` was correctly set in `.env.local`, Prisma was reading the stale placeholder from `.env` and trying to connect to `localhost:5432`.

---

## The Fix: Explicitly Load `.env.local`

We replaced the generic `dotenv/config` import with a targeted dotenv call:

```ts
import path from "path";
import { config } from "dotenv";

// Explicitly point dotenv at .env.local
config({ path: path.resolve(__dirname, ".env.local") });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),      // now reads from .env.local ✅
    directUrl: env("DIRECT_URL"),  // added: required for migrations
  },
});
```

`path.resolve(__dirname, ".env.local")` constructs the absolute path to `.env.local` relative to the config file's own directory. This is important — if you use a relative path like `".env.local"`, it resolves relative to wherever you run `npx prisma`, not relative to the config file.

---

## Why `directUrl` Is Needed

We also added `directUrl` to the Prisma config, which wasn't there before:

```ts
datasource: {
  url:       env("DATABASE_URL"),   // PgBouncer pooled — for runtime
  directUrl: env("DIRECT_URL"),     // Direct — for migrations
},
```

Prisma migrations run long-lived commands (schema introspection, DDL statements, creating migration records). PgBouncer in **transaction mode** only allows a database connection to be held for the duration of a single transaction. Some of Prisma's migration operations span multiple transactions and will fail behind a pooler.

**Rule of thumb:**

| Connection | Use for |
|------------|---------|
| `DATABASE_URL` (pooled, port 6543) | Application runtime — Next.js, Prisma queries |
| `DIRECT_URL` (direct, port 5432) | Prisma CLI — `migrate dev`, `migrate deploy`, `db push` |

This is why Supabase provides two separate connection strings.

---

## The Schema Gap: `emailVerified`

When we first tried signing in with Google, we got:

```
[next-auth][error][adapter_error_createUser]
Unknown argument `emailVerified`
```

The `@next-auth/prisma-adapter` requires that the `User` model has an `emailVerified` field typed as `DateTime?`. It's part of NextAuth's expected schema contract. Our original model was missing it:

```prisma
// Before (missing emailVerified):
model User {
  id        String  @id @default(cuid())
  email     String  @unique
  name      String?
  image     String?
  // ...
}

// After (correct):
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?           // ← required by @next-auth/prisma-adapter
  name          String?
  image         String?
  // ...
}
```

This is a common pitfall when setting up NextAuth with Prisma from scratch rather than using the auto-generated schema from NextAuth's documentation. The adapter internally calls:

```ts
p.user.create({
  data: {
    email: "...",
    emailVerified: null,  // always sent, even when null
    name: "...",
  }
})
```

If `emailVerified` isn't in your schema, Prisma's client validation rejects it before the query ever reaches the database.

**The fix** was straightforward — add the field and run a migration:

```bash
npx prisma migrate dev --name add-email-verified
npx prisma generate
```

The migration added the column to the existing table, and `prisma generate` updated the TypeScript client to include the new field.

---

## The Migration Workflow in Practice

Every schema change follows the same three-step cycle:

```
1. Edit prisma/schema.prisma
        ↓
2. npx prisma migrate dev --name <description>
   → Diffs the schema against the current DB state
   → Generates a .sql migration file in prisma/migrations/
   → Applies the SQL to the database
   → Runs prisma generate automatically
        ↓
3. Restart your dev server
   → The new Prisma client is picked up
```

The migration files in `prisma/migrations/` are committed to git. They are the permanent, ordered record of every schema change. Never delete or edit them manually — treat them like git history.

---

## Key Takeaway

> Credentials and environment loading fail silently in surprising ways. When a tool isn't reading the file you think it is, check which tool it actually is and what its dotenv convention is. Next.js reads `.env.local`; most other Node.js tools read `.env`. When in doubt, be explicit: point `dotenv` at the exact file path you intend, and verify the result before assuming it worked.

---

**Next:** [Lesson 14 — Setting Up Google OAuth Credentials](./14-google-oauth-credentials.md)

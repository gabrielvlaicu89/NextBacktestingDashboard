# Lesson 45 — Environment Variables Across Host and Container Boundaries

Environment variables look simple until the same application has to run in two different network contexts: directly on the host machine and inside Docker. Then the meaning of a value like `DATABASE_URL=postgresql://...@localhost:5432/...` changes completely. In this lesson, we document how we designed the frontend environment so local manual runs and full Docker Compose runs can both work without duplicating the entire configuration surface.

---

## Section: The Concept or Problem

The frontend depends on several services and secrets at once:

- PostgreSQL for Prisma
- FastAPI for backtest and optimization proxy routes
- NextAuth secrets for session signing
- Google OAuth credentials for login

The difficult part is that some of those values differ depending on *where the frontend is running*.

### Host-run frontend

If you run `npm run dev` on your laptop:

```text
Next.js process
  ├── reaches PostgreSQL at localhost:5432
  └── reaches FastAPI at localhost:8000
```

### Container-run frontend

If Next.js runs inside Docker Compose:

```text
frontend container
  ├── reaches PostgreSQL at db:5432
  └── reaches FastAPI at backend:8000
```

So the exact same application needs different hostnames depending on execution context.

---

## Section: The Implementation

### Local-first `.env.example`

We updated [frontend/.env.example](./frontend/.env.example) to document the host-run case first:

```env
# Copy this file to .env.local for local development.
#
# Local-first defaults below assume:
# - Next.js runs on your host at http://localhost:3000
# - FastAPI runs on your host at http://localhost:8000
# - PostgreSQL runs locally via docker-compose on port 5432

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/backtester"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/backtester"

NEXTAUTH_SECRET="replace-with-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"

GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

BACKEND_URL="http://localhost:8000"
```

Why local-first? Because `.env.example` should answer the question: *what should I put in `.env.local` if I want to run this app on my machine right now?*

We also kept Supabase values as commented reference lines:

```env
# DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
# DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

That preserves deployment knowledge without making hosted infrastructure the default dev path.

### Compose overrides for container networking

The frontend service in [docker-compose.yml](./docker-compose.yml) deliberately overrides some env vars:

```yaml
environment:
  - DATABASE_URL=postgresql://postgres:postgres@db:5432/backtester
  - DIRECT_URL=postgresql://postgres:postgres@db:5432/backtester
  - BACKEND_URL=http://backend:8000
  - NEXTAUTH_URL=http://localhost:3000
```

This is the key idea:

- `.env.local` stores secrets and human-managed values
- Compose overrides network-dependent values when the runtime context changes

### Why `NEXTAUTH_URL` stays `localhost`

This is subtle. The frontend container talks to the backend using `backend:8000`, but `NEXTAUTH_URL` remains `http://localhost:3000`.

Why? Because `NEXTAUTH_URL` is not an internal service address. It is the public URL the browser uses for auth callbacks and cookie scope.

If you changed it to `http://frontend:3000`, Google OAuth would break because the browser and Google do not know what `frontend` means outside the Docker network.

### Prisma config aligns CLI behavior with Next.js behavior

We also rely on [frontend/prisma.config.ts](./frontend/prisma.config.ts):

```ts
import path from "path";
import { config } from "dotenv";

// Load .env.local so Prisma CLI picks up the same variables as Next.js
config({ path: path.resolve(__dirname, ".env.local") });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: env("DIRECT_URL"),
  },
});
```

This prevents a common mismatch:

```text
Next.js reads .env.local      → connects successfully
Prisma CLI reads a different file or nothing at all → migration fails
```

By explicitly loading `.env.local`, Prisma CLI and the frontend app read the same values unless Compose overrides them.

---

## Section: Why We Made This Choice

### Why not commit separate `.env.compose.example` and `.env.local.example` files?

That would make the context split more explicit, but it would also force developers to choose between multiple templates before they even start. The project is still in active development, and the simpler model is:

1. keep one canonical `.env.example`
2. make it work for the most common path: host-based local dev
3. let Docker Compose override only the values that differ in containers

This is a good trade-off because it keeps secrets centralized while still respecting container networking rules.

### Why not put auth secrets directly in Compose?

Because secrets do not belong in versioned infrastructure files. [docker-compose.yml](./docker-compose.yml) is shared project configuration. OAuth secrets and `NEXTAUTH_SECRET` are user-specific runtime values. They stay in `frontend/.env.local`, which is excluded from git.

### Why use both `DATABASE_URL` and `DIRECT_URL` locally when they are the same?

In hosted setups like Supabase, Prisma often needs:

- `DATABASE_URL` for pooled runtime access
- `DIRECT_URL` for direct migration access

Locally, both can safely point to the same Postgres instance. Keeping both variables present locally avoids special-case code and ensures the local config matches the production shape.

| Variable | Local Docker Postgres | Hosted Supabase |
|---|---|---|
| `DATABASE_URL` | `localhost` or `db` | pooled connection |
| `DIRECT_URL` | same as local DB | direct connection |

---

## Section: What Broke and How We Fixed It

### Symptom: Compose booted the stack, but the frontend had to use different hostnames than manual dev

At the beginning, the mental model was inconsistent:

- docs assumed `localhost`
- containers needed `db` and `backend`
- Prisma migrations needed whichever values matched the current execution context

That is the kind of issue that does not always appear as a compile error. Instead, it shows up as runtime failures like:

```text
Prisma cannot connect to database
Backend unreachable
OAuth callback mismatch
```

### Root Cause

The root cause was treating environment variables as static configuration instead of **context-sensitive wiring**. A hostname is not just data; it is a statement about network topology.

### Fix

We split responsibility cleanly:

```text
frontend/.env.local
  └── secrets + host-based local defaults

docker-compose.yml
  └── runtime-specific overrides for container networking

prisma.config.ts
  └── forces Prisma CLI to read the same env file as Next.js
```

### General Lesson

When a value changes because the process location changes, that is not “just another env var.” It is a network-boundary problem. Solve it by making the runtime context explicit.

---

## Key Takeaway

> Good environment design separates secrets from topology. Keep secrets in `.env.local`, document host-based defaults in `.env.example`, and let Docker Compose override only the network-dependent values that change inside containers.

---

**Next:** [Lesson 46 — Installing, Validating, and Smoke Testing the Docker Stack](./46-docker-install-validation-smoke-test.md)

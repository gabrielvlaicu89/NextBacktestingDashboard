# Lesson 44 — Docker Compose for a Full-Stack Local Development Environment

A monorepo stops feeling professional the moment each service has to be started by hand with tribal knowledge. The goal of a local orchestration file is not just convenience; it is to encode the system topology in one place so that every developer, tool, and automation run the same stack. In this lesson, we turn a partial Docker setup into a real full-stack local environment that brings up PostgreSQL, FastAPI, and Next.js together.

---

## Section: The Concept or Problem

Before this work, the repository had a Docker Compose file, but it only described two services:

1. PostgreSQL
2. FastAPI backend

That is useful, but incomplete. The real application is a three-tier system:

```text
Browser
  │
  ▼
Next.js frontend  ─────→  Prisma / PostgreSQL
  │
  ▼
FastAPI backend   ─────→  Market data APIs
```

If Docker Compose manages only the database and backend, the frontend still has to be started manually, with its own undocumented environment assumptions. That creates two problems:

| Problem | Why it matters |
|---|---|
| Partial orchestration | `docker compose up` does not actually give you the whole app |
| Hidden startup knowledge | Developers must remember extra steps like `npm install`, `prisma migrate deploy`, and `npm run dev` |

The fix is to treat Docker Compose as the **source of truth for local topology**.

---

## Section: The Implementation

The updated [docker-compose.yml](./docker-compose.yml) now defines all three local services.

### The Database Service

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: backtester
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

Important details:

- `postgres:16-alpine` keeps the image smaller than a full Debian-based image.
- `restart: unless-stopped` makes local restarts resilient.
- The named volume `postgres_data` keeps your local database state between container restarts.

### The Backend Service

```yaml
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/backtester
    depends_on:
      - db
    volumes:
      - ./backend:/app
```

This service does three things:

1. builds the FastAPI image from [backend/Dockerfile](./backend/Dockerfile)
2. injects backend secrets from `backend/.env`
3. rewrites the database host to `db`, which is the Compose service name

That last point matters. Inside a Compose network, containers do not reach each other via `localhost`; they reach each other via service names.

### The Frontend Service

```yaml
  frontend:
    image: node:20-alpine
    working_dir: /app
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - ./frontend/.env.local
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/backtester
      - DIRECT_URL=postgresql://postgres:postgres@db:5432/backtester
      - BACKEND_URL=http://backend:8000
      - NEXTAUTH_URL=http://localhost:3000
      - NEXT_TELEMETRY_DISABLED=1
      - WATCHPACK_POLLING=true
    depends_on:
      - db
      - backend
    volumes:
      - ./frontend:/app
      - frontend_node_modules:/app/node_modules
    command: >
      sh -c "npm ci && npx prisma migrate deploy && npm run dev -- --hostname 0.0.0.0"
```

This is the key upgrade. The frontend container is not a static build artifact; it is a **development container**.

Why each line exists:

| Line | Why |
|---|---|
| `image: node:20-alpine` | We need a Node runtime, not a custom production image yet |
| `env_file: ./frontend/.env.local` | Keeps auth secrets and OAuth credentials outside version control |
| `DATABASE_URL=...@db:5432` | Overrides host-based env values so Prisma talks to the Postgres container |
| `BACKEND_URL=http://backend:8000` | Makes Next.js proxy routes call the FastAPI container over the internal network |
| `WATCHPACK_POLLING=true` | Improves filesystem watching reliability in mounted container volumes |
| `./frontend:/app` | Enables live editing from the host filesystem |
| `frontend_node_modules:/app/node_modules` | Prevents host/container dependency conflicts and avoids bind-mounting host `node_modules` |
| `npm ci && npx prisma migrate deploy && npm run dev` | Encodes the actual startup sequence into the container itself |

### The Resulting Topology

```text
Host machine
  │
  ├── localhost:3000 ──→ frontend container
  ├── localhost:8000 ──→ backend container
  └── localhost:5432 ──→ db container

Internal Docker network
  │
  ├── frontend ──→ backend:8000
  ├── frontend ──→ db:5432
  └── backend  ──→ db:5432
```

This dual view is the core mental model: **host ports for the browser, service names for container-to-container traffic**.

---

## Section: Why We Made This Choice

### Why add the frontend to Compose?

**Alternative:** Keep the frontend outside Docker and document manual startup.

That is simpler at first, but it splits your local workflow into two worlds:

- Docker for the backend/database
- local Node/Prisma for the frontend

That creates drift. The frontend may accidentally rely on host-installed Node versions, globally installed Prisma, or machine-specific shell state. By putting it in Compose, startup becomes reproducible.

### Why use a generic Node image instead of a custom frontend Dockerfile?

**Alternative:** Build a dedicated `frontend/Dockerfile`.

We rejected that for now because this is a **development** stack, not a production deployment image. A dev container benefits from simplicity:

- mount the source code directly
- install dependencies at runtime
- run `next dev`

A dedicated production Dockerfile makes more sense later, when we optimize image size, build caching, and immutable deployments.

### Why run Prisma migrations inside the frontend container?

Because Prisma belongs to the frontend codebase, not the backend. The database schema, auth tables, and persistence models are all defined in [frontend/prisma/schema.prisma](./frontend/prisma/schema.prisma). If the frontend container starts without applying migrations, NextAuth and strategy persistence may fail at runtime.

---

## Section: What Broke and How We Fixed It

### Symptom: Compose validated, but modern Docker printed a warning

When we first ran compose validation, Docker reported:

```text
the attribute `version` is obsolete, it will be ignored
```

### Root Cause

Older Compose files commonly started with:

```yaml
version: "3.9"
```

Modern Docker Compose v2 no longer needs this field. It infers the schema automatically. The file still works, but the warning is telling you the line is legacy noise.

### Fix

We removed the top-level `version` key entirely.

### General Lesson

Infrastructure files age differently than application code. A file can still be *valid* but no longer *idiomatic*. Validation warnings are often telling you about future maintenance cost, not just immediate breakage.

---

## Key Takeaway

> Docker Compose is not just a launcher; it is the executable diagram of your local architecture. Once the frontend joined the file, `docker compose up` stopped meaning “part of the app is running” and started meaning “the system is running.”

---

**Next:** [Lesson 45 — Environment Variables Across Host and Container Boundaries](./45-env-design-host-vs-container.md)

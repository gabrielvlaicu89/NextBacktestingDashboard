# Lesson 09 — Docker & Local Development

## What is a Container?

A container is a lightweight, isolated environment that packages an application together with everything it needs to run: the runtime, libraries, configuration, and code.

Without containers, "it works on my machine" is a real problem. Developer A has Python 3.11, developer B has Python 3.9. The production server has Python 3.10. Each has a different version of `pandas`. Behavior differs. Bugs appear only in certain environments.

Containers solve this by making the environment part of the artifact. The container image specifies exactly "Python 3.11.9, with these packages at these versions." Everyone runs the same image.

## Dockerfile — Building the FastAPI Service

Our `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching optimization)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Why `slim`?

`python:3.11-slim` is a minimal Python image (~50 MB vs ~900 MB for the full image). It contains only what's needed to run Python. Smaller images mean faster builds, faster deployments, and a smaller attack surface.

### Why Copy `requirements.txt` Before the Rest of the Code?

Docker builds images in **layers**. Each instruction (`COPY`, `RUN`, `FROM`) creates a new layer. Docker caches layers and only rebuilds from the first changed layer onward.

```
Layer 1: FROM python:3.11-slim          ← almost never changes
Layer 2: COPY requirements.txt          ← changes when deps change
Layer 3: RUN pip install                ← only rebuilt when Layer 2 changes
Layer 4: COPY . .                       ← changes every time you edit code
Layer 5: CMD [...]                      ← never changes
```

If you copy all your code first, then copy `requirements.txt` and `pip install`, Layer 4 (source code) changes every time you edit a file — which forces Layer 5 (`pip install`) to re-run even when dependencies haven't changed. With the order above, `pip install` only re-runs when `requirements.txt` actually changes. This turns a 2-minute build into a 5-second build for most code changes.

## docker-compose.yml — Orchestrating Services

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: backtester
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  fastapi:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    volumes:
      - ./backend:/app
    depends_on:
      - postgres
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

volumes:
  postgres_data:
```

### `ports: "8000:8000"` — Host:Container Mapping

The format is `host_port:container_port`. Port 8000 inside the container is made accessible as port 8000 on your machine. Your browser can then reach it at `http://localhost:8000`.

### `volumes` — Two Different Uses

**Named volume** (`postgres_data:/var/lib/postgresql/data`): Stores database files on a Docker-managed volume. The data persists even when the container stops or is deleted. Without this, your database would be wiped every time you ran `docker compose down`.

**Bind mount** (`./backend:/app`): Mounts your local `./backend` directory into the container at `/app`. Changes you make to local files are instantly visible inside the container. Combined with `--reload` in the uvicorn command, the FastAPI server restarts automatically when you edit code. This is the hot-reload development experience without rebuilding the image.

### `depends_on`

```yaml
fastapi:
  depends_on:
    - postgres
```

`depends_on` ensures `postgres` starts before `fastapi`. Note: this waits for the container to *start*, not for Postgres to be *ready* to accept connections. A more robust setup uses a `healthcheck`, but `depends_on` is sufficient for local development since Postgres starts quickly.

## Why Run Local Postgres When Supabase Exists?

A fair question. We have Supabase in the cloud — why set up a local Postgres container?

**Development speed.** Cloud connections have latency (50–200ms per query). Local connections are near-instant. When you're running migrations and testing data shapes, this difference adds up.

**Isolation.** Your local experiments don't affect other developers (or your own staging environment). You can `DROP TABLE` everything without consequence.

**Offline work.** Local Postgres works without internet. Supabase requires connectivity.

**Cost.** Supabase free tier has connection and storage limits. Local Postgres has none.

In production, we use Supabase. In development, we use local Postgres. The `DATABASE_URL` in `.env.local` points to local Docker, while the production environment variable in Vercel points to Supabase.

## Common Docker Commands

```bash
# Start everything
docker compose up

# Start in background (detached)
docker compose up -d

# View logs for FastAPI service
docker compose logs -f fastapi

# Stop everything (containers removed, data preserved in volumes)
docker compose down

# Stop and delete all volumes (wipes database!)
docker compose down -v

# Rebuild the fastapi image (after adding a dependency to requirements.txt)
docker compose up --build fastapi

# Open a shell inside the running container
docker compose exec fastapi bash
```

## The Next.js Frontend — No Docker (For Now)

Notice that `docker-compose.yml` doesn't include the frontend. We run Next.js directly with `npm run dev`. Why?

- Next.js hot reload is already excellent without Docker
- Adding it to Docker in development adds complexity without much benefit
- Node.js version management (`nvm`) is sufficient for local dev
- The dev server (`localhost:3000`) communicates with FastAPI (`localhost:8000`) directly

We could containerize the frontend for production deployment, but for local development, the native `npm run dev` experience is superior.

## Key Takeaway

> Docker ensures that "works locally" and "works in production" mean the same thing. `docker-compose` turns a complex multi-service setup into a single command. The volume bind mount trick gives you hot-reload inside a container — the best of both worlds.

---

**Next:** [Lesson 10 — shadcn/ui & Tailwind CSS](./10-shadcn-ui-and-tailwind.md)

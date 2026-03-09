# Lesson 46 — Installing, Validating, and Smoke Testing the Docker Stack

Infrastructure work is only complete when the stack has actually been exercised on a real machine. A Compose file that looks correct in Git is still unproven until Docker is installed, services start, migrations run, and endpoints respond from the host. In this lesson, we document the operational path from “Docker is not installed” to “the full application is live on localhost,” including the exact bugs encountered along the way.

---

## Section: The Concept or Problem

There are three separate layers of “works locally,” and it is important not to confuse them:

| Layer | Question |
|---|---|
| Static config | Is `docker-compose.yml` valid YAML and valid Compose syntax? |
| Orchestration | Can Docker actually build and start the services? |
| Runtime verification | Do the started services respond at the expected URLs? |

A lot of teams stop at layer 1. We did not. We went all the way through installation and runtime verification.

---

## Section: The Implementation

### Step 1: Install Docker and Compose v2

On this Ubuntu 24.04 machine, neither `docker` nor `docker-compose` was available. The correct installation path was:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Why these commands matter:

| Command | Why |
|---|---|
| `apt install docker.io docker-compose-v2` | Installs Docker Engine and the modern Compose plugin |
| `systemctl enable --now docker` | Starts the daemon immediately and enables it for future boots |
| `usermod -aG docker "$USER"` | Allows non-root Docker usage in future shells |

### Step 2: Validate the Compose file

Once Docker was installed, we ran:

```bash
sudo docker compose config
```

This does two useful things:

1. validates the Compose schema
2. expands the final config after env interpolation

Initially it emitted a warning about an obsolete field:

```text
the attribute `version` is obsolete, it will be ignored
```

We then removed the top-level `version` key from [docker-compose.yml](./docker-compose.yml) and re-ran validation until it was clean.

### Step 3: Start the stack

The stack was started with:

```bash
sudo docker compose up --build
```

The startup sequence that actually happened was:

```text
1. Pull db and frontend base images
2. Build backend image from backend/Dockerfile
3. Create Docker network and volumes
4. Start PostgreSQL container
5. Start FastAPI backend container
6. Start frontend container
7. Run npm ci inside frontend container
8. Run prisma generate inside frontend container
9. Run prisma migrate deploy inside frontend container
10. Start Next.js dev server on 0.0.0.0:3000
```

That is exactly what we wanted: the container itself encodes the frontend bootstrap process.

### Step 4: Verify host endpoints

Normally we would reach for `curl`, but this machine did not have it installed. Instead, we verified the services from the host using Python's standard library:

```python
from urllib.request import urlopen, Request

for url in ["http://localhost:8000/health", "http://localhost:3000"]:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=10) as response:
        body = response.read(200).decode("utf-8", errors="replace")
        print(url, response.status, response.headers.get("Content-Type"))
        print(body[:200])
```

The results were:

```text
http://localhost:8000/health  → 200  application/json  {"status":"ok"}
http://localhost:3000         → 200  text/html         <!DOCTYPE html>...
```

That is the decisive proof that the stack was not merely started, but reachable from the host system.

---

## Section: Why We Made This Choice

### Why install `docker-compose-v2` instead of legacy `docker-compose`?

Ubuntu still exposes the legacy package, but modern Docker has standardized on the plugin form:

```bash
docker compose ...
```

not:

```bash
docker-compose ...
```

We chose the v2 plugin because:

- it matches current Docker documentation
- it avoids legacy warnings and behavioral drift
- it aligns with what developers are most likely to have on modern Linux and macOS setups

### Why use `sudo docker compose` during validation even after adding the user to the docker group?

Because group membership changes do not apply retroactively to already-open shells. There are two ways to solve that:

1. start a new login shell
2. use `sudo` for the current session

For immediate validation, `sudo docker compose ...` was the pragmatic option.

### Why verify with Python instead of installing `curl`?

Because the point of the verification step was to prove the app worked, not to expand the machine’s package footprint. Python was already present and reliable. Using `urllib.request` avoided another system-level install just for an HTTP check.

---

## Section: What Broke and How We Fixed It

This phase had several memorable infrastructure bugs.

### Bug 1: `docker-compose` command not found

#### Symptom

```text
Command 'docker-compose' not found
```

#### Root Cause

The machine had no Docker tooling installed.

#### Fix

Install `docker.io` and `docker-compose-v2`, then switch to the modern `docker compose` command.

#### General Lesson

When an infrastructure command is missing, first ask whether the problem is “bad project config” or “missing host capability.” These are different classes of failure.

### Bug 2: `docker compose` command not found

#### Symptom

```text
Command 'docker' not found
```

#### Root Cause

The Docker Engine binary itself was not installed, so the Compose plugin had nothing to attach to.

#### Fix

Install `docker.io`, not just a Compose wrapper package.

### Bug 3: compose warning about obsolete `version`

#### Symptom

```text
the attribute `version` is obsolete, it will be ignored
```

#### Root Cause

The Compose file used an older pattern that modern Compose tolerates but no longer needs.

#### Fix

Remove the top-level `version` field and re-run validation.

### Bug 4: `curl` not found while checking endpoints

#### Symptom

```text
Command 'curl' not found
```

#### Root Cause

The machine lacked the utility; the app itself was not at fault.

#### Fix

Use Python’s `urllib.request` for endpoint verification.

### Bug 5: Docker group change not reflected immediately

#### Symptom

Docker commands still needed `sudo` after `usermod -aG docker "$USER"`.

#### Root Cause

UNIX group membership is loaded when the shell session starts. Existing terminals do not automatically inherit the new group list.

#### Fix

Use `sudo docker ...` for the current shell, or start a fresh login session later.

### The Full Validation Flow

```text
No docker installed
   │
   ▼
Install docker.io + docker-compose-v2
   │
   ▼
Start daemon with systemctl
   │
   ▼
Validate compose file
   │
   ├── warning about obsolete version
   │       ▼
   │    remove version key
   │
   ▼
Run docker compose up --build
   │
   ▼
Observe db, backend, frontend startup logs
   │
   ▼
Verify localhost:8000/health and localhost:3000
   │
   ▼
Confirmed: full local stack operational
```

---

## Key Takeaway

> Infrastructure is only real when it survives contact with a machine. The important work was not just writing `docker-compose.yml`; it was installing Docker, validating the file, fixing compatibility warnings, booting the stack, and proving that both the API and the UI answered on localhost.

---

**Next:** [Lesson 47 — ...](./47-placeholder.md)

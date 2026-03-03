# Lesson 08 — Environment Variables & Security

## What Are Environment Variables?

An environment variable is a named value stored *outside* your code, in the operating system's environment (or a `.env` file). Your application reads them at runtime with `process.env.VARIABLE_NAME`.

**Why not just put secrets in the code?**

```ts
// ❌ Never do this
const supabaseUrl = "https://abc123.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6..." // service role key
```

If you commit this to git, the secret is now in the repository history **forever** — even if you delete it in a later commit. Anyone with access to the repo (including future contributors, or if it's ever made public) can extract and misuse it.

Environment variables keep secrets out of source control entirely.

## The Files We Created

### `frontend/.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

This file is **only for local development**. It is listed in `.gitignore` and is never committed.

### `frontend/.env.example`

```
NEXT_PUBLIC_SUPABASE_URL=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DATABASE_URL=
DIRECT_URL=
```

This file **is** committed to git. It documents which environment variables are required without exposing their values. When a new developer clones the repository, they:
1. Copy `.env.example` to `.env.local`
2. Fill in their own values

This is the standard pattern for every professional project.

## Next.js Environment Loading Order

Next.js reads environment files in a specific priority order (highest first):

```
1. process.env (actual OS environment — used in production/Vercel)
2. .env.local        (local overrides, never committed)
3. .env.development  (only loaded in dev mode)
4. .env.production   (only loaded in production mode)
5. .env              (base fallback, can be committed for non-secrets)
```

The first match wins. This means your `.env.local` always overrides the base `.env`.

In production (Vercel), you set environment variables through the Vercel dashboard — they're injected as actual OS environment variables, so no `.env` file is needed on the server.

## `NEXT_PUBLIC_` Prefix — Client vs Server Variables

Next.js has a critical security rule about variable names:

| Variable name | Accessible on server? | Accessible in browser? |
|---|---|---|
| `DATABASE_URL` | ✅ Yes | ❌ Never |
| `GOOGLE_CLIENT_SECRET` | ✅ Yes | ❌ Never |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | ✅ Yes (bundled into JS) |

**Default: server-only.** Any variable without `NEXT_PUBLIC_` is stripped from the JavaScript bundle sent to the browser. If you try to access `process.env.DATABASE_URL` in a Client Component, you get `undefined`.

**`NEXT_PUBLIC_` variables** are inlined into the browser bundle at build time. They become public. Never put secrets in `NEXT_PUBLIC_` variables.

Our `NEXT_PUBLIC_SUPABASE_URL` is safe to expose — it's the URL of the Supabase project (not a secret). The actual service role key (`SUPABASE_SERVICE_ROLE_KEY`) has no `NEXT_PUBLIC_` prefix and never reaches the browser.

## `NEXTAUTH_SECRET`

```
NEXTAUTH_SECRET=some-random-string
```

This secret is used by NextAuth to:
- Sign and verify JWT session tokens
- Encrypt sensitive data in OAuth callbacks

It should be a random 32+ character string. Generate one with:

```bash
openssl rand -base64 32
```

If this secret changes, all existing sessions are immediately invalidated — every user is logged out.

## The Two Supabase Connection URLs

Already covered in Lesson 04, but worth restating from a security angle:

- `DATABASE_URL` — uses PgBouncer (connection pooler). This URL includes the mode=transaction parameter for pgBouncer compatibility.
- `DIRECT_URL` — connects directly to Postgres. More privileged, only used for Prisma migrations.

Both should have strong passwords. Neither should ever be committed to git.

## The Python Backend: `backend/.env`

```
ENVIRONMENT=development
DATABASE_URL=postgresql://...
ALPHA_VANTAGE_API_KEY=optional_for_now
```

FastAPI reads this with `python-dotenv`:

```python
from dotenv import load_dotenv
load_dotenv()
import os
db_url = os.getenv("DATABASE_URL")
```

The same principles apply: `.env` is gitignored, `.env.example` is committed.

## `.gitignore` — Your Last Line of Defense

Our root `.gitignore` includes:

```
# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
backend/.env
```

But `.gitignore` only works for **untracked** files. If you accidentally `git add .env` and commit it, git will track it despite `.gitignore`. To fix this:

```bash
git rm --cached .env      # remove from tracking without deleting the file
git commit -m "Remove accidentally committed .env"
```

After that, `.gitignore` will prevent future accidental commits.

## What Goes in Each File — Summary

| Variable | `.env.local` | `.env.example` | Vercel Dashboard |
|----------|:---:|:---:|:---:|
| NEXTAUTH_SECRET | ✅ | empty string | ✅ |
| GOOGLE_CLIENT_ID | ✅ | empty string | ✅ |
| DATABASE_URL | ✅ | empty string | ✅ |
| NEXT_PUBLIC_SUPABASE_URL | ✅ | empty string | ✅ |
| NEXTAUTH_URL | `http://localhost:3000` | `http://localhost:3000` | `https://yourdomain.com` |

## Key Takeaway

> Treat every secret like a password. It should exist in exactly two places: your local `.env.local` (not in git) and your hosting provider's secrets manager. The `.env.example` file is the communication channel between developers — it tells them what they need without showing them what you have.

---

**Next:** [Lesson 09 — Docker & Local Development](./09-docker-and-local-development.md)

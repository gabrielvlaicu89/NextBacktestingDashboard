# Lesson 02 — Next.js App Router

## The Two Routing Systems in Next.js

Next.js has had two different routing systems. You need to know which one you're using because they work very differently:

| | Pages Router (old) | App Router (current) |
|---|---|---|
| Directory | `/pages/` | `/app/` |
| Data fetching | `getServerSideProps`, `getStaticProps` | async Server Components |
| Layouts | Manual wrapping | `layout.tsx` files |
| Available since | v1 | v13 (stable v14+) |

We use the **App Router** — it's the current standard and the one Next.js is actively improving.

## How File-Based Routing Works

In the App Router, **the file system is your router**. Every folder inside `app/` that contains a `page.tsx` file becomes a URL route.

```
app/
├── layout.tsx              → wraps every page (root layout)
├── page.tsx                → route: /
├── (auth)/
│   ├── login/
│   │   └── page.tsx        → route: /login
│   └── layout.tsx          → layout for auth pages only
└── dashboard/
    ├── layout.tsx           → layout for all dashboard pages
    ├── page.tsx             → route: /dashboard
    ├── new/
    │   └── page.tsx         → route: /dashboard/new
    ├── results/
    │   └── [id]/
    │       └── page.tsx     → route: /dashboard/results/[id]  ← dynamic segment
    └── compare/
        └── page.tsx         → route: /dashboard/compare
```

### Special File Names

The App Router reserves these filenames — they have specific meaning:

| File | Purpose |
|---|---|
| `page.tsx` | The UI for that route — what the user sees |
| `layout.tsx` | Wraps child pages; doesn't remount on navigation |
| `loading.tsx` | Shown while the page is loading (Suspense boundary) |
| `error.tsx` | Shown when the page throws (error boundary) |
| `not-found.tsx` | Shown for 404 within that segment |
| `route.ts` | API endpoint (no UI) |

### Route Groups: `(auth)` and `(dashboard)`

Parentheses in folder names create **route groups**. The folder name is **not** part of the URL.

```
app/(auth)/login/page.tsx  →  URL is /login, not /(auth)/login
```

This is purely an organization tool. We use `(auth)` to group the login page (and give it a different layout from the dashboard) without affecting the URL.

## Server Components vs. Client Components

This is the most important mental model for App Router.

**By default, every component in the App Router is a Server Component.** It runs on the server, never ships its code to the browser, and can directly access databases or secrets.

```tsx
// This is a Server Component (no directive needed — it's the default)
// It can do this:
const strategies = await prisma.strategy.findMany()

// But it CANNOT do this:
const [count, setCount] = useState(0)  // ← Error! No hooks in server components
```

To use React hooks, browser APIs, or event listeners, you add `"use client"` at the top:

```tsx
"use client"

// Now this is a Client Component
// It CAN do this:
const [count, setCount] = useState(0)

// But it CANNOT directly query the database
```

### The Mental Model

Think of it as two zones:

```
Server Zone                    Client Zone
─────────────────              ─────────────────────────
Runs on server only            Runs in the browser
Can read DB, secrets           Can use hooks, DOM events
Fast, no JS bundle             Interactive, reactive
"use server" (default)         "use client" directive
```

A Server Component can **import** a Client Component. A Client Component **cannot** import a Server Component.

## API Routes

Files named `route.ts` inside `app/api/` are **API endpoints** — they handle HTTP requests but return data, not HTML.

```ts
// app/api/tickers/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")
  // ... fetch from Yahoo Finance
  return Response.json(results)
}
```

We use these as a **proxy layer** between the browser and our Python backend — the Next.js API route calls FastAPI, then forwards the response. This keeps the Python backend unexposed and lets us add auth checks server-side.

## The Current `app/` Structure (After Phase 1)

Right now we have what `create-next-app` generated — a minimal starter:

```
frontend/app/
├── favicon.ico
├── globals.css
├── layout.tsx     ← root layout (currently default)
└── page.tsx       ← home page (currently default landing)
```

In Phase 5 we'll build out the full route structure described above.

## Key Takeaway

> App Router = "your folder structure is your routes, your files have specific roles, and components are server-first by default." The server/client boundary is the concept that takes the most practice — when in doubt, keep things as Server Components until you need interactivity, then add `"use client"`.

---

**Next:** [Lesson 03 — TypeScript & tsconfig](./03-typescript-and-tsconfig.md)

# Lesson 19 — Next.js API Routes as a Secure Proxy Layer

In a full-stack app with a separate backend service, the frontend should never talk to the
backend directly from the browser. If it did, your backend URL, auth tokens, and internal
API structure would be exposed to every user who opens DevTools. Instead, Next.js API routes
act as a **proxy layer** — they sit between the browser and FastAPI, enforce authentication,
adapt the request format, and handle persistence. This lesson explains how Phase 4 designed
that proxy, and why certain decisions were made the way they were.

---

## Section: The Problem — Why Not Call FastAPI from the Browser?

The naive approach is a client component that calls FastAPI directly:

```typescript
// ❌ Anti-pattern: browser calls FastAPI directly
const res = await fetch("http://localhost:8000/api/backtest/run", {
  method: "POST",
  body: JSON.stringify(payload),
});
```

This has three critical problems:

| Problem | Consequence |
|---|---|
| CORS exposure | FastAPI must allow `*` origins in production, enabling any site to call your backend |
| No server-side auth | The browser sends whatever it wants — no session check before triggering a compute-heavy backtest |
| No Prisma access | The browser can't write results to the database — it has no connection string |

The fix: every browser request goes to a Next.js API route at `/api/...`, which enforces
auth, calls FastAPI server-side, and handles any DB writes.

```
Browser
  │
  ├── /api/backtest?runId=xxx ──► Next.js route (auth check, Prisma read, Prisma write)
  │                                   │
  │                                   └─► FastAPI POST /api/backtest/run (SSE stream)
  │
  ├── /api/tickers?q=SPY ──────► Next.js route (auth check)
  │                                   │
  │                                   └─► FastAPI GET /api/tickers/search?q=SPY
  │
  └── /api/strategies ────────► Next.js route (auth check, zod validation, Prisma write)
```

---

## Section: Authentication Pattern — One Guard per Route

Every route handler begins with the same two-line auth guard:

```typescript
// frontend/app/api/strategies/route.ts

export async function GET() {
  const session = await getServerSession();       // ① server-side session check
  if (!session?.user?.id) {                       // ② treat missing ID same as missing session
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ...safe to use session.user.id from here
}
```

**① Server-side only** — `getServerSession()` reads the JWT cookie from Next.js's server
request context. This runs on the server, so the browser never sends a bearer token that
could be stolen.

**② `?.user?.id` not just `?.user`** — NextAuth can return a `session` with a `user` object
that has no `id` if the JWT callback failed or the adapter was misconfigured. The double
optional chain catches both cases and prevents the route from proceeding with a partial session.

**Why not middleware?** The `proxy.ts` middleware already redirects unauthenticated users away
from `/dashboard` pages. But API routes don't get that redirect — a client-side fetch to
`/api/strategies` from a logged-out user would receive whatever the route handler returns.
That's why each route handler independently re-checks the session.

---

## Section: The Backtest SSE Proxy — The Most Complex Route

The backtest route (`app/api/backtest/route.ts`) is the most architecturally complex piece in
Phase 4. It does five things in sequence:

```
GET /api/backtest?runId=xxx
        │
        ├─ 1. Auth check (401 if not logged in)
        ├─ 2. Prisma lookup (BacktestRun + Strategy)
        ├─ 3. Short-circuit if run is already COMPLETED or FAILED (return cached data)
        ├─ 4. Mark run as RUNNING in Prisma
        └─ 5. Proxy FastAPI SSE stream
                │
                ├─ Forward all events to the browser (TransformStream)
                ├─ Parse "complete" events → update Prisma (COMPLETED, results, duration)
                └─ Parse "error" events → update Prisma (FAILED, errorMsg, duration)
```

The most subtle part is the streaming proxy using Web Streams:

```typescript
// frontend/app/api/backtest/route.ts

const { readable, writable } = new TransformStream();  // ① create a pipe
const writer = writable.getWriter();
const encoder = new TextEncoder();

const processStream = async () => {          // ② background async function
  const reader = fastApiResponse.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";                           // ③ incomplete-event buffer

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });  // ④ incremental decode
      const blocks = buffer.split("\n\n");                // ⑤ split on SSE delimiters
      buffer = blocks.pop() || "";                        // ⑥ keep trailing fragment

      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed.startsWith("data: ")) continue;

        await writer.write(encoder.encode(trimmed + "\n\n")); // ⑦ forward to browser

        // Parse and persist key events
        const data = JSON.parse(trimmed.slice(6));            // ⑧ strip "data: "
        if (data.type === "complete") {
          await prisma.backtestRun.update({ ... });           // ⑨ write to DB
        }
      }
    }
  } finally {
    await writer.close().catch(() => {});                     // ⑩ always close the pipe
  }
};

processStream(); // run in background — don't await

return new Response(readable, {
  headers: { "Content-Type": "text/event-stream", ... },
});
```

**① `TransformStream`** — Creates a `readable` end and a `writable` end. The route returns
`readable` to the browser immediately. The `processStream` coroutine writes to `writable` as
it reads from FastAPI. The browser sees events in real time.

**② Not awaited intentionally** — `processStream()` is invoked without `await`. The route
handler returns the `Response` first, establishing the SSE connection. The async processing
then populates it concurrently.

**③④⑤⑥ Buffer management** — TCP packets don't align with SSE event boundaries. A single
`reader.read()` call may return half an event or three events. The buffer accumulates chunks,
splits on `"\n\n"` (the SSE event terminator), and saves the trailing fragment for the next
iteration. Without this buffer, the JSON parser would receive partial event strings and crash.

**⑦ Re-encoding** — The FastAPI stream delivers `Uint8Array` chunks. The proxy decodes to
string, parses for side effects, then re-encodes to `Uint8Array` for the browser pipe.

**⑨ Persistence** — FastAPI doesn't know about Prisma. The proxy intercepts the `"complete"`
event and writes `results + status + duration` to the `BacktestRun` row. This is the only
place that bridges the Python world to the database.

**⑩ `finally` close** — If the browser disconnects mid-stream (user navigates away), the
reader loop will throw. The `finally` block ensures the writable pipe is always closed,
preventing a resource leak and an unresolved `TransformStream` handle.

---

## Section: The Strategies CRUD Routes

The strategies endpoints follow a simpler pattern — no streaming, just standard REST:

```typescript
// app/api/strategies/route.ts — POST (create)

const body = await req.json();
const parsed = createStrategySchema.safeParse(body);  // ① zod validation

if (!parsed.success) {
  return Response.json(
    { error: "Validation failed", details: parsed.error.flatten() },
    { status: 400 },                                  // ② 400 not 500 — client mistake
  );
}

const strategy = await prisma.strategy.create({       // ③ write to Prisma
  data: {
    userId: session.user.id,                          // ④ never from request body
    ...parsed.data,
  },
});

return Response.json({ ...strategy }, { status: 201 }); // ⑤ 201 Created
```

**① zod before Prisma** — Validation happens before any DB operation. An invalid payload
returns immediately with a structured error; Prisma never sees bad data.

**② 400 vs 500** — 400 means "you sent bad data". 500 means "our server crashed".
Validation failures are always 400.

**③④ `userId` from session, never from body** — A malicious user could POST
`{ "userId": "other-user-id" }`. Using `session.user.id` from the verified JWT guarantees
strategies are always attributed to the authenticated user.

**⑤ 201 for creation** — 200 means "OK, existing resource". 201 means "created a new resource".
A client that caches responses or a test suite that asserts `status === 201` will break if
you return 200 for POST.

The `[id]` dynamic route follows the same pattern, with an additional ownership check:

```typescript
if (existing.userId !== session.user.id) {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}
```

This prevents user A from reading or deleting user B's strategies, even if they know the ID.
IDs are cuid strings — not sequential integers — but obscurity is not security.

---

## Section: Serialising Prisma Dates for JSON

Prisma returns `DateTime` fields as JavaScript `Date` objects. `Response.json()` serialises
`Date` using `toISOString()` automatically, but only in some environments. To be safe and
consistent across all runtimes, every route handler converts dates explicitly:

```typescript
return Response.json({
  ...strategy,
  dateFrom: strategy.dateFrom.toISOString(),   // "2024-01-01T00:00:00.000Z"
  dateTo:   strategy.dateTo.toISOString(),
  createdAt: strategy.createdAt.toISOString(),
  updatedAt: strategy.updatedAt.toISOString(),
});
```

Without this, different deployment targets (Vercel edge, Node.js, Bun) may serialise
`Date` objects differently — or omit them entirely. Explicit `toISOString()` calls guarantee
a predictable, JSON-safe string on every runtime.

---

## Key Takeaway

> Next.js API routes are not thin pass-through wrappers — they are the **security boundary** between the public internet and your backend. Every route must check session auth independently, validate input with zod before touching any database, and always attribute data to `session.user.id` rather than trusting any user-supplied identifier.

---

**Next:** [Lesson 20 — Redux Toolkit: Slices, the Client/Server State Boundary, and Typed Hooks](./20-redux-toolkit-slices.md)

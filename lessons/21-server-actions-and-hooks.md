# Lesson 21 — Server Actions vs API Routes, and Custom Hooks for SSE and Debouncing

Next.js 13+ introduced Server Actions as a way to run server-side code directly from Client
Components without writing an API route at all. This creates a genuine architectural choice:
should mutations go through Server Actions or API routes? And for client-side real-time
communication — like an SSE backtest stream or a debounced ticker search — what's the right
hook pattern? This lesson answers both questions with the concrete code written in Phase 4.

---

## Section: Server Actions vs API Routes — When to Use Which

Both Server Actions and API routes run on the server and can query Prisma. The difference
is in how they're called and what they return.

| | Server Actions | API Routes |
|---|---|---|
| **Called from** | Client Components via direct import | Anywhere via `fetch()` |
| **Returns** | Any serialisable JS value | `Response` object (HTTP) |
| **Auth** | Must call `getServerSession()` manually | Must call `getServerSession()` manually |
| **Streaming** | ❌ Not supported | ✅ `StreamingResponse` / `ReadableStream` |
| **Browser cache** | ❌ No HTTP caching semantics | ✅ Full HTTP cache control |
| **Use case** | Mutations, CRUD | Streaming SSE, external proxies, caching |

In Phase 4 we used **both**, strictly based on these rules:

```
Mutation (no streaming needed)
  └─► Server Action        e.g. createBacktestRun(), deleteStrategy()

Read + streaming (EventSource can't call server actions)
  └─► API route            e.g. GET /api/backtest?runId=xxx (SSE)

External proxy (must return HTTP response with headers)
  └─► API route            e.g. GET /api/tickers?q=... (proxy to FastAPI)
```

---

## Section: Server Actions — `lib/actions/strategies.ts`

```typescript
// frontend/lib/actions/strategies.ts

"use server";

export async function createStrategy(input: unknown): Promise<StrategyRecord> {
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");   // ① throw, not Response.json

  const parsed = createStrategySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${JSON.stringify(parsed.error.flatten())}`);
  }

  const strategy = await prisma.strategy.create({ ... });

  revalidatePath("/dashboard");    // ② invalidate server cache for dashboard
  return serialiseStrategy(strategy);
}
```

**① `throw` not `Response.json()`** — Server Actions can't return `Response` objects.
Errors propagate as thrown exceptions, which Next.js serialises back to the client.
The calling component wraps the action in `try/catch`:

```tsx
try {
  await deleteStrategy(id);
} catch (err) {
  toast.error(err instanceof Error ? err.message : "Delete failed");
}
```

**② `revalidatePath("/dashboard")`** — When a strategy is created or deleted, Next.js has
a cached version of the `/dashboard` page from a previous server render. `revalidatePath`
marks that cache entry as stale, so the next navigation to `/dashboard` re-runs the Server
Component and fetches fresh data from Prisma. Without this, the user would see the old
strategy list until they did a hard refresh.

### The serialise helper — Date → ISO string

Prisma returns Dates; JSON transport requires strings. A shared helper converts them:

```typescript
function serialiseStrategy(s: { dateFrom: Date; dateTo: Date; createdAt: Date; updatedAt: Date; ... }): StrategyRecord {
  return {
    ...s,
    dateFrom:  s.dateFrom.toISOString(),
    dateTo:    s.dateTo.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    // force-cast JSON columns to typed shapes
    parameters:  s.parameters as Record<string, unknown>,
    riskSettings: s.riskSettings as StrategyRecord["riskSettings"],
  };
}
```

The `parameters` and `riskSettings` fields are stored as Prisma `Json` — which TypeScript
types as `JsonValue` (a recursive union). Casting to known shapes is safe here because the
data was validated by zod on write. The alternative — making every consumer handle `JsonValue`
— would infect the entire type system with complexity.

---

## Section: The `createBacktestRun` Server Action

This action bridges two worlds: the Server Action creates the Prisma records, and the hook
opens an EventSource to stream the results.

```typescript
// frontend/lib/actions/backtest.ts

"use server";

export async function createBacktestRun(input: { ... }): Promise<CreateRunResult> {
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = backtestRequestSchema.safeParse(input);         // ① validate
  if (!parsed.success) throw new Error(`Validation failed: ...`);

  const strategy = await prisma.strategy.create({ ... });        // ② create Strategy

  const run = await prisma.backtestRun.create({                  // ③ create BacktestRun
    data: {
      strategyId: strategy.id,
      userId: session.user.id,
      status: "PENDING",                                         // ④ not yet running
    },
  });

  return { strategyId: strategy.id, runId: run.id };            // ⑤ IDs only, no data
}
```

**④ Status starts as PENDING** — The actual execution happens when the API route opens the
FastAPI SSE connection. PENDING → RUNNING → COMPLETED is the lifecycle. If the server action
returns successfully but the API route never gets called (e.g., the user navigates away),
the run stays in PENDING indefinitely. Phase 11 will add a cleanup job or timeout for these orphaned runs.

**⑤ Return IDs, not data** — The server action returns only `{ strategyId, runId }`.
The actual backtest results stream over the subsequent SSE connection. Returning the results
from the server action would require waiting for the entire backtest to finish — up to minutes —
before the action resolves. SSE specifically exists to avoid that wait.

---

## Section: `useBacktestStream` — The SSE Orchestration Hook

This hook orchestrates the full backtest lifecycle:

```
useBacktestStream.startBacktest(config)
         │
         ├─ 1. dispatch(resetBacktest())
         ├─ 2. dispatch(setStatus("running"))
         ├─ 3. await createBacktestRun(config)  ← server action (Prisma write)
         │            returns { strategyId, runId }
         ├─ 4. dispatch(setStrategyId(...))
         ├─ 5. dispatch(setRunId(...))
         └─ 6. new EventSource(`/api/backtest?runId=${runId}`)
                     │
                     ├─ onmessage("progress") → dispatch(setProgress + setMessage)
                     ├─ onmessage("complete") → dispatch(setResults + setStatus + close)
                     └─ onmessage("error")    → dispatch(setError + setStatus + close)
```

```typescript
// frontend/hooks/useBacktestStream.ts

"use client";

export function useBacktestStream() {
  const dispatch = useAppDispatch();
  const eventSourceRef = useRef<EventSource | null>(null);  // ① ref, not state

  const abort = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const startBacktest = useCallback(
    async (config: BacktestConfig) => {
      dispatch(resetBacktest());
      dispatch(setStatus("running"));

      try {
        const { strategyId, runId } = await createBacktestRun(config);  // ② server action
        dispatch(setStrategyId(strategyId));
        dispatch(setRunId(runId));

        abort(); // close any existing connection before opening a new one

        const es = new EventSource(`/api/backtest?runId=${runId}`);  // ③ SSE connection
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          const data: SSEEvent = JSON.parse(event.data);
          switch (data.type) {
            case "progress":
              dispatch(setProgress(data.percent));
              dispatch(setMessage(data.message));
              break;
            case "complete":
              dispatch(setResults(data.results));
              dispatch(setStatus("completed"));
              es.close();                          // ④ close after terminal event
              eventSourceRef.current = null;
              break;
            case "error":
              dispatch(setError(data.message));
              dispatch(setStatus("failed"));
              es.close();
              eventSourceRef.current = null;
              break;
          }
        };

        es.onerror = () => {
          dispatch(setError("Connection to backtest stream lost"));
          dispatch(setStatus("failed"));
          es.close();
          eventSourceRef.current = null;
        };
      } catch (err) {
        dispatch(setError(err instanceof Error ? err.message : "Failed to start backtest"));
        dispatch(setStatus("failed"));
      }
    },
    [dispatch, abort],
  );

  return { startBacktest, abort };
}
```

**① `useRef` not `useState` for the EventSource** — The `EventSource` object is imperative
infrastructure, not UI state. Storing it in `useRef` means changes to it don't trigger
re-renders. If it were `useState`, every time a new `EventSource` was created, all components
subscribed to this hook would re-render, potentially tearing down and re-mounting mid-stream.

**② `await createBacktestRun(config)`** — This is a direct call to a `"use server"` function
from a `"use client"` hook. Next.js bundles the server action as a server-to-server RPC.
The client component never executes the function body — it calls a generated network stub
that POST-marshals arguments to the server.

**③ `EventSource`** — The browser's built-in SSE client. Unlike `fetch`, it automatically
reconnects on connection loss, handles `retry:` headers from the server, and fires `onerror`
on network failures. It only supports GET requests and no custom body — which is exactly why
the server action creates the DB records first and the EventSource only needs a `runId`.

**④ `es.close()` on terminal events** — Unlike WebSockets, `EventSource` will keep trying to
reconnect after the server closes the stream. Explicitly calling `es.close()` on the client
side after a `"complete"` or `"error"` event prevents the browser from re-opening the connection
and re-running the query.

---

## Section: `useTickerSearch` — Debouncing with AbortController

The ticker search hook shows two important patterns: debouncing to avoid spamming the API,
and `AbortController` to cancel in-flight stale requests.

```typescript
// frontend/hooks/useTickerSearch.ts

"use client";

export function useTickerSearch(debounceMs = 300) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);  // ① imperative, not state

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const timer = setTimeout(async () => {                // ② debounce
      abortRef.current?.abort();                          // ③ cancel previous request
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/tickers?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,                      // ④ attach signal to fetch
        });
        if (res.ok) {
          setResults(await res.json());
        } else {
          setResults([]);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return; // ⑤ ignore
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => { clearTimeout(timer); };  // ⑥ cleanup on re-render
  }, [query, debounceMs]);

  return { query, setQuery, results, loading };
}
```

**② Debouncing** — Without the `setTimeout`, every keystroke fires a network request.
Typing "AAPL" would fire four requests: "A", "AA", "AAP", "AAPL". With 300ms debouncing,
only the last request fires if the user types faster than one character per 300ms.

**③+④ `AbortController`** — Even with debouncing, the user might type slowly enough that
two requests are in-flight simultaneously. "AA" and "AAP" might return out of order —
the stale "AA" result could overwrite the fresh "AAP" result. `AbortController` cancels the
previous fetch before starting the new one, guaranteeing only the most recent request resolves.

**⑤ Ignore `AbortError`** — Calling `controller.abort()` causes the `fetch` promise to
reject with a `DOMException` named `"AbortError"`. This is not an actual error — it's the
expected outcome of cancellation. Without the guard, the `catch` block would call
`setResults([])`, clearing the previously displayed results unnecessarily.

**⑥ Cleanup** — `useEffect` cleanup runs before the next render. `clearTimeout(timer)`
ensures the pending debounce timer is cancelled when the query changes mid-debounce, so a
stale request doesn't fire after the hook has moved on to a newer query.

### The alternative: a library

We could have used `useSWR` or `@tanstack/react-query` for this. Both provide debounced
fetching, stale-while-revalidate, caching, and abort handling out of the box. We chose not
to because:

1. Adding another library needs justification per the project's `copilot-instructions.md`
2. The custom hook is 50 lines and covers exactly what we need — no more
3. It makes the debounce and abort patterns transparent and teachable

For a production app with many data-fetching needs, React Query would be the right choice.
For a learning project, the manual implementation is more educational.

---

## Section: The Zod + TypeScript Types Architecture

Phase 4 added two foundational files that everything else depends on:

```
lib/types.ts        — TypeScript interfaces (structural/static)
lib/validations.ts  — Zod schemas (runtime validation)
```

They cover the same domain but serve different purposes:

| | `types.ts` | `validations.ts` |
|---|---|---|
| **Purpose** | Type-check at compile time | Validate at runtime |
| **Where used** | Every TS file that needs the shape | API routes, server actions, forms |
| **What it catches** | Wrong field name, wrong field type | Missing required fields, out-of-range values, wrong date format |
| **Example** | `interface RiskSettings { starting_capital: number }` | `z.object({ starting_capital: z.number().min(100) })` |

Why both? TypeScript types are erased at runtime — a TypeScript interface can't validate
data that arrives as JSON over the network. Zod validates the actual bytes. They're
complementary, not redundant.

The zod schemas are designed to mirror the backend Pydantic schemas exactly:

```
Backend Pydantic           →   Frontend zod
─────────────────────────────────────────────────────
RiskSettings.starting_capital: float = Field(ge=100)
                           →   starting_capital: z.number().min(100)

BacktestRequest.strategy_type: StrategyType
                           →   strategy_type: z.enum(STRATEGY_TYPES)

BacktestRequest.date_from: date
                           →   date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
```

This symmetry means validation failures are caught on the frontend before the request is
even sent — reducing round trips and giving users faster feedback.

---

## Key Takeaway

> Use Server Actions for mutations that don't need streaming (create, update, delete) and API routes for anything that needs HTTP semantics (streaming SSE, proxy with custom headers). For browser-side real-time connections, store the `EventSource` in a `useRef` — not `useState` — so that connection management doesn't trigger re-renders. Always pair debounced search with `AbortController` to avoid stale results overtaking fresh ones.

---

**Next:** [Lesson 22 — Phase 5: App Shell, Sidebar Layout, and Dark Mode](./22-app-shell-layout.md)

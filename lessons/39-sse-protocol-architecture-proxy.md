# Lesson 39 — Server-Sent Events: The Protocol, the Architecture, and the Proxy Problem

Server-Sent Events (SSE) is the simplest protocol for real-time server-to-client streaming over HTTP. Unlike WebSockets, SSE uses plain HTTP, supports automatic reconnection in the browser, and flows through CDNs and proxies without special configuration. This lesson explains how SSE works at the wire level, why our architecture needs a proxy layer between client and backend, and the critical constraint that forced us to use two different streaming patterns.

---

## The SSE Wire Protocol

SSE is a text-based protocol over HTTP. The server returns a response with `Content-Type: text/event-stream` and never closes the connection until the stream is done. Each event is a block of text terminated by two newlines (`\n\n`):

```
data: {"type": "progress", "percent": 10, "message": "Fetching data…"}

data: {"type": "progress", "percent": 50, "message": "Running strategy…"}

data: {"type": "complete", "results": {...}}

```

Every line begins with `data: ` followed by arbitrary text (we use JSON). The double-newline is the *event boundary* — the client knows one event is complete when it sees `\n\n`.

On the server side, we build events with a helper function in [backend/app/services/optimizer.py](backend/app/services/optimizer.py):

```python
def _sse(event_type: str, *, percent=None, message=None, results=None, result=None) -> str:
    data: dict = {"type": event_type}
    if percent is not None:
        data["percent"] = percent
    if message is not None:
        data["message"] = message
    if results is not None:
        data["results"] = results
    if result is not None:
        data["result"] = result
    return f"data: {json.dumps(data)}\n\n"
```

The `_sse()` function is deliberately simple — it's just string formatting. There's no library, no framework helper. SSE is simple enough that writing the framing by hand is the clearest approach. The `f"data: {json.dumps(data)}\n\n"` line is the entire protocol implementation.

### Event Types as a State Machine

We defined three event types as a contract between backend and frontend:

| Event Type | Fields | Semantics |
|-----------|--------|-----------|
| `progress` | `percent`, `message`, `result?` | Intermediate update — UI should show a progress bar |
| `complete` | `results` | Terminal success — stream will close after this |
| `error` | `message` | Terminal failure — stream will close after this |

The stream always follows one pattern: zero or more `progress` events, then exactly one `complete` or `error`. The frontend relies on this contract — when it sees `complete` or `error`, it closes the connection and stops listening.

These types are defined in [frontend/lib/types.ts](frontend/lib/types.ts):

```typescript
export interface SSEProgressEvent {
  type: "progress";
  percent: number;
  message: string;
  result?: OptimizeResultEntry;  // only for optimization streams
}

export interface SSECompleteEvent {
  type: "complete";
  results: BacktestResponse;
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
}

export type SSEEvent = SSEProgressEvent | SSECompleteEvent | SSEErrorEvent;
```

The discriminated union (`SSEEvent`) gives TypeScript exhaustive checking in the `switch` statement — if we add a fourth event type, the compiler will flag every switch that doesn't handle it.

---

## FastAPI's Streaming Response

FastAPI streams SSE via `StreamingResponse` wrapping an async generator. Here's the backtest endpoint from [backend/app/routers/backtest.py](backend/app/routers/backtest.py):

```python
@router.post("/run")
async def run_backtest(request: BacktestRequest):
    return StreamingResponse(
        _stream_backtest(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

Three details matter:

1. **`media_type="text/event-stream"`** — tells the client this is an SSE stream, not a regular JSON response.
2. **`Cache-Control: no-cache`** — prevents intermediate proxies (Nginx, Cloudflare) from buffering events and delivering them all at once when the stream closes.
3. **`X-Accel-Buffering: no`** — Nginx-specific header that disables response buffering. Without this, Nginx will collect the entire response before forwarding it, completely defeating the purpose of streaming.

The `_stream_backtest()` generator yields events at each processing step:

```python
async def _stream_backtest(request: BacktestRequest) -> AsyncGenerator[str, None]:
    try:
        yield _sse("progress", percent=10, message="Fetching market data…")
        await asyncio.sleep(0)  # flush event to client

        df = await asyncio.to_thread(fetch_ohlcv, ...)
        # ... more processing ...

        yield _sse("progress", percent=100, message="Done")
        yield _sse("complete", results=results.model_dump())
    except Exception as exc:
        yield _sse("error", message=str(exc))
```

The `await asyncio.sleep(0)` after each yield is critical. Without it, Python's event loop might batch multiple yields together before actually writing bytes to the HTTP response. The `sleep(0)` forces a context switch that flushes the event.

### Why SSE Always Returns HTTP 200

Notice that errors are sent *inside* the SSE stream as data events — the HTTP status code is always 200. This is by design: the SSE connection is established first (200), then events flow. If there's an error during processing, we can't retroactively change the status code. This is why the error event is a JSON payload, not an HTTP error:

```python
except Exception as exc:
    yield _sse("error", message=str(exc))
```

The only time we get a non-200 is when Pydantic validation fails *before* streaming starts — FastAPI returns 422 because the request never reached our generator.

---

## The EventSource Constraint: Why We Need Two Patterns

Here's the design decision that shaped the entire architecture.

The browser's `EventSource` API — the standard way to consume SSE — only supports **GET** requests. You pass it a URL, it opens a GET request, and listens for events. There is no way to send a POST body.

But our FastAPI backtest endpoint is **POST** — the client needs to send a JSON payload with strategy type, ticker, date range, parameters, and risk settings. This is far too much data for query parameters.

We had three options:

| Option | Approach | Rejected Because |
|--------|----------|-----------------|
| A | Change backend to GET + query params | Payload too complex; URL length limits |
| B | Change frontend to Fetch + ReadableStream for both | Loses EventSource's auto-reconnection |
| C | **Use a proxy layer that converts GET → POST** | ✅ Chosen — best of both worlds |

**Option C** is what we implemented. The Next.js proxy at [frontend/app/api/backtest/route.ts](frontend/app/api/backtest/route.ts) accepts a **GET** from EventSource with just a `runId`, looks up the full configuration from the database, and makes a **POST** to FastAPI.

For the optimization endpoint, the payload is even more complex (parameter ranges, fixed parameters, optimize-for metric), and we don't persist optimization configs in the database. So we used **Fetch + ReadableStream** instead of EventSource — the client posts JSON directly through the proxy.

### The Two Patterns Side by Side

```
BACKTEST (EventSource / GET):
┌────────────┐       GET /api/backtest?runId=x        ┌────────────┐       POST /api/backtest/run       ┌────────────┐
│   Browser   │ ──────────────────────────────────────► │  Next.js   │ ─────────────────────────────────► │  FastAPI   │
│ EventSource │ ◄── SSE events (text/event-stream) ─── │   Proxy    │ ◄── SSE events ─────────────────── │  Backend   │
└────────────┘                                         │  + Prisma  │  (persists results to DB)          └────────────┘
                                                       └────────────┘

OPTIMIZE (Fetch ReadableStream / POST):
┌────────────┐    POST /api/optimize {JSON body}       ┌────────────┐    POST /api/backtest/optimize    ┌────────────┐
│   Browser   │ ──────────────────────────────────────► │  Next.js   │ ─────────────────────────────────► │  FastAPI   │
│fetch().body │ ◄── SSE stream (ReadableStream) ─────── │   Proxy    │ ◄── SSE stream ──────────────────── │  Backend   │
│  .getReader │                                         │ (pass-thru)│  (no DB persistence)               └────────────┘
└────────────┘                                         └────────────┘
```

The key difference: the backtest proxy is *smart* (reads from DB, writes results back, transforms GET → POST), while the optimization proxy is *dumb* (just forwards the request and pipes the response body through).

---

## The Next.js Proxy: TransformStream for Dual-Write

The backtest proxy in [frontend/app/api/backtest/route.ts](frontend/app/api/backtest/route.ts) needs to do two things simultaneously:

1. **Forward** every SSE event to the browser in real-time
2. **Intercept** the `complete` or `error` event to persist results in Prisma

This is a classic *tee* pattern. We use a `TransformStream` to split the stream:

```typescript
const { readable, writable } = new TransformStream();
const writer = writable.getWriter();
const encoder = new TextEncoder();

const processStream = async () => {
    const reader = fastApiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split("\n\n");
            buffer = blocks.pop() || "";

            for (const block of blocks) {
                const trimmed = block.trim();
                if (!trimmed.startsWith("data: ")) continue;

                // 1) Forward to client
                await writer.write(encoder.encode(trimmed + "\n\n"));

                // 2) Intercept terminal events
                try {
                    const data = JSON.parse(trimmed.slice(6));
                    if (data.type === "complete" && data.results) {
                        await prisma.backtestRun.update({
                            where: { id: runId },
                            data: { status: "COMPLETED", results: data.results, duration: Date.now() - startTime },
                        });
                    }
                } catch { /* JSON parse error — non-critical */ }
            }
        }
    } finally {
        await writer.close().catch(() => {});
    }
};

processStream(); // fire-and-forget — runs in background

return new Response(readable, {
    headers: { "Content-Type": "text/event-stream" },
});
```

The crucial line is `processStream()` — called **without** `await`. The function starts processing the stream in the background, and `new Response(readable)` is returned immediately. As `processStream` writes chunks to `writable`, they flow through the `TransformStream` and appear on `readable` for the client.

### Why Not Just Use `response.body` Directly?

The optimization proxy *does* pipe the response body directly:

```typescript
return new Response(fastApiResponse.body, {
    headers: { "Content-Type": "text/event-stream" },
});
```

We can't do this for the backtest proxy because we need to intercept the stream. If we just pass `fastApiResponse.body` through, we have no way to read the `complete` event and update the database. The `TransformStream` gives us a write-side (where we send intercepted data) and a read-side (what the client consumes).

---

## State Management: Redux vs Local State

The backtest and optimization hooks take different approaches to state management, and the reason is *scope of interest*:

| Hook | State Location | Why |
|------|---------------|-----|
| `useBacktestStream` | Redux (`backtestSlice`) | Progress must survive navigation between `/dashboard/new` and `/dashboard/results/[id]` |
| `useOptimizeStream` | Local `useState` | Results are ephemeral — only needed on the `/dashboard/optimize/[id]` page |

The backtest hook dispatches to Redux:

```typescript
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
            dispatch(setProgress(100));
            es.close();
            break;
    }
};
```

The optimization hook uses `useState`:

```typescript
if (data.type === "progress") {
    setProgress(data.percent ?? 0);
    setMessage(data.message ?? "");
}
```

The Redux approach means that if the user starts a backtest on `/dashboard/new` and navigates to `/dashboard/results/[id]`, the `ResultsDashboard` component picks up the in-progress state from the Redux store — the progress bar continues where it left off. Optimization doesn't need this because the user stays on the same page throughout.

---

## Key Takeaway

> SSE is a deceptively simple protocol — `data: {json}\n\n` over HTTP — but the real architecture challenge is bridging the `EventSource` GET-only constraint with POST-based backends. A proxy layer that converts between HTTP methods, persists results, and tees the stream for dual-write is the cleanest solution, more maintainable than workarounds like encoding payloads into URLs or abandoning `EventSource` entirely.

---

**Next:** [Lesson 40 — Progressive Streaming and Testing SSE Pipelines](./40-progressive-streaming-and-testing-sse.md)

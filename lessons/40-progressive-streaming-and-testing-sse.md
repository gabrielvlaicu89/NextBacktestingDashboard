# Lesson 40 — Progressive Streaming and Testing SSE Pipelines

When a grid-search optimization tests 100 parameter combinations, the user shouldn't stare at a spinner for two minutes and then see all results at once. Progressive rendering — showing each result the moment it completes — transforms a blank-screen wait into an engaging, informative experience. This lesson covers how we piped individual results through the SSE stream, accumulated them on the client, and thoroughly tested every layer of the pipeline.

---

## The Problem: Batch Results vs Progressive Results

Before Phase 10, the optimization flow was all-or-nothing:

```
Backend computes 100 combos silently → sends "complete" with all 100 results → Frontend renders
```

Progress events existed, but they only carried `percent` and `message` — no data. The heatmap and results table couldn't render until the final `complete` event arrived. This is fine for 5 combinations, but painful for 100.

The fix: attach each individual result to its progress event, so the frontend can render the heatmap cell-by-cell.

---

## Backend: Attaching Results to Progress Events

In [backend/app/services/optimizer.py](backend/app/services/optimizer.py), the key change was adding a `result` field to each progress event. Previously the loop looked like this:

```python
# BEFORE — result is appended to a list, only sent at the end
results.append({
    "params": {k: round(float(v), 6) for k, v in zip(param_keys, combo)},
    "metric": round(float(metric_value), 6) if metric_value is not None else None,
})
yield _sse("progress", percent=pct, message=f"[{idx+1}/{total}] {param_str}")
```

After the change:

```python
# AFTER — each result is sent immediately AND collected for the final event
entry = {
    "params": {k: round(float(v), 6) for k, v in zip(param_keys, combo)},
    "metric": round(float(metric_value), 6) if metric_value is not None else None,
}
results.append(entry)

yield _sse("progress", percent=pct, message=f"[{idx+1}/{total}] {param_str}", result=entry)
```

The `result` field is *optional* on progress events — the initial "Starting grid search" event doesn't carry one, and backtest progress events never carry one. This keeps backward compatibility with existing consumers.

The `_sse()` helper gains one new keyword argument:

```python
def _sse(event_type, *, percent=None, message=None, results=None, result=None):
    data = {"type": event_type}
    if percent is not None: data["percent"] = percent
    if message is not None: data["message"] = message
    if results is not None: data["results"] = results   # plural — complete event
    if result is not None:  data["result"] = result      # singular — progress event
    return f"data: {json.dumps(data)}\n\n"
```

Note the naming: `results` (plural) is the full array on the `complete` event; `result` (singular) is the individual entry on each `progress` event. This distinction makes it impossible to confuse the two in client-side parsing.

### Why Still Send the Complete Event?

We still send `yield _sse("complete", results=results)` with ALL results at the end. This redundancy is intentional:

1. **Authoritative source** — if a progress event was dropped (network hiccup, buffer overflow), the complete event has the canonical dataset.
2. **Simpler consumers** — a client that doesn't care about progressive rendering can ignore `result` on progress events and just wait for `complete`.
3. **Status signal** — the frontend uses `complete` to transition from "running" to "completed". Without it, the client wouldn't know streaming is done.

---

## Frontend: Accumulating Partial Results

In [frontend/hooks/useOptimizeStream.ts](frontend/hooks/useOptimizeStream.ts), the stream-reading loop now maintains an `accumulated` array alongside the existing `useState`:

```typescript
const accumulated: OptimizeResultEntry[] = [];

// Inside the stream processing loop:
if (data.type === "progress") {
    setProgress(data.percent ?? 0);
    setMessage(data.message ?? "");
    // Accumulate individual result for progressive rendering
    if (data.result) {
        accumulated.push(data.result as OptimizeResultEntry);
        setResults([...accumulated]);
    }
} else if (data.type === "complete") {
    // Final authoritative results from the backend
    setResults(data.results as OptimizeResultEntry[]);
    setStatus("completed");
    setProgress(100);
}
```

### Why a Local Array Instead of Reading from State?

You might wonder: why maintain a separate `accumulated` array instead of reading from `results` state and appending? Because `setResults` is asynchronous — React batches state updates, so `results` may not reflect the latest value when the next progress event arrives on the same event-loop tick. The local `accumulated` array is always synchronous and always current.

The `[...accumulated]` spread creates a new array reference on every update, which triggers React re-renders. If we pushed to the same array and called `setResults(accumulated)`, React would see the same reference and skip the re-render.

### Why the Complete Event Overrides Accumulated Results

When the `complete` event arrives, we call `setResults(data.results)` — replacing the accumulated array entirely. This is the "authoritative override" pattern:

```typescript
} else if (data.type === "complete") {
    setResults(data.results as OptimizeResultEntry[]);  // overrides accumulated
    setStatus("completed");
    setProgress(100);
}
```

If a progress event was lost (e.g., a network blip caused a partial chunk), the accumulated array would be incomplete. The complete event corrects this. In practice, on localhost the events are always identical. Over real networks, this redundancy provides resilience.

---

## The UI: Rendering During "Running" State

In [frontend/components/optimization/optimize-client.tsx](frontend/components/optimization/optimize-client.tsx), the results panel was previously gated on `status === "completed"`:

```tsx
{/* BEFORE — results only after completion */}
{status === "completed" && results && results.length > 0 && (
    <OptimizeResults results={results} ... />
)}
```

We widened the condition to include `"running"`:

```tsx
{/* AFTER — results during running AND after completion */}
{(status === "completed" || status === "running") && results && results.length > 0 && (
    <OptimizeResults results={results} ... />
)}
```

This is the entire UI change. Because we already had the `results` state updating progressively, and `OptimizeResults` is a pure component that renders whatever data it receives, the table and heatmap naturally grow row-by-row as events arrive.

---

## Testing SSE: Three Layers, Three Strategies

SSE testing is tricky because each layer of the stack has different affordances. Here's how we tested each one.

### Layer 1: Backend (FastAPI TestClient)

FastAPI's `TestClient` (from Starlette) buffers the entire streaming response into a string. In [backend/tests/test_sse_streaming.py](backend/tests/test_sse_streaming.py), we use a `_parse_sse()` helper to split the response text back into event dicts:

```python
def _parse_sse(text: str) -> list[dict]:
    events = []
    for block in text.split("\n\n"):
        block = block.strip()
        if block.startswith("data: "):
            data_str = block.replace("data: ", "", 1)
            try:
                events.append(json.loads(data_str))
            except json.JSONDecodeError:
                continue
    return events
```

This lets us test the full event sequence as a flat list:

```python
@patch("app.services.optimizer.fetch_ohlcv", side_effect=_mock_ohlcv)
def test_optimize_progress_includes_individual_results(self, mock_fetch, client):
    response = client.post("/api/backtest/optimize", json={...})
    events = _parse_sse(response.text)
    progress_with_results = [
        e for e in events if e["type"] == "progress" and "result" in e
    ]
    assert len(progress_with_results) >= 2

    for ev in progress_with_results:
        assert "params" in ev["result"]
        assert "metric" in ev["result"]
```

The `@patch` decorator replaces `fetch_ohlcv` with a function returning synthetic data — this makes tests fast, deterministic, and independent of network access. We patch at the import site (`app.services.optimizer.fetch_ohlcv`), not the definition site (`app.services.data_fetcher.fetch_ohlcv`), because Python's mock system patches the *name reference* at the point of use.

### Layer 2: EventSource Hook (useBacktestStream)

The `EventSource` API is a browser global that doesn't exist in Node.js / jsdom. We need to mock it entirely. In [frontend/__tests__/hooks/useBacktestStream.test.tsx](frontend/__tests__/hooks/useBacktestStream.test.tsx):

```typescript
class MockEventSource {
  url: string;
  onmessage: EventSourceListener = null;
  onerror: ErrorListener = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    lastEventSource = this;  // capture for test assertions
  }
}

beforeEach(() => {
  globalThis.EventSource = MockEventSource;
});
```

The mock captures the instance in a module-level `lastEventSource` variable, so tests can simulate events after the hook opens the connection:

```typescript
function emitMessage(data: Record<string, unknown>) {
  lastEventSource.onmessage(
    new MessageEvent("message", { data: JSON.stringify(data) })
  );
}
```

Because `useBacktestStream` dispatches to Redux, the hook needs a store. We use a `makeWrapper()` helper that creates a fresh store per test and returns it alongside the wrapper component:

```typescript
function makeWrapper() {
  const store = createTestStore();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }
  return { store, Wrapper };
}
```

Then tests can assert on the store directly:

```typescript
it("dispatches progress to Redux on progress events", async () => {
  const { store, Wrapper } = makeWrapper();
  const { result } = renderHook(() => useBacktestStream(), { wrapper: Wrapper });

  await act(async () => { await result.current.startBacktest(makeConfig()); });
  act(() => { emitMessage({ type: "progress", percent: 42, message: "Fetching…" }); });

  const state = store.getState().backtest;
  expect(state.progress).toBe(42);
  expect(state.status).toBe("running");
});
```

This pattern — mock the global, capture the instance, simulate events, assert on the store — works for any `EventSource`-based hook.

### Layer 3: Fetch + ReadableStream Hook (useOptimizeStream)

The optimization hook uses `fetch()` instead of `EventSource`. We mock `global.fetch` to return a synthetic `ReadableStream`:

```typescript
function makeSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const sseText = events.map(e => `data: ${e}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });
}

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  body: makeSseStream([
    JSON.stringify({ type: "progress", percent: 50, result: { params: {x: 10}, metric: 0.8 } }),
    JSON.stringify({ type: "complete", results: [...] }),
  ]),
});
```

The `makeSseStream` function simulates what the browser receives over the wire: a stream of bytes containing SSE-formatted text. The `ReadableStream` constructor's `start(controller)` callback enqueues all data immediately and closes — this simulates a fast server. For slow-server testing, you can use `setTimeout` inside the callback to enqueue chunks at intervals.

Testing progressive accumulation:

```typescript
it("accumulates partial results from progress events with result field", async () => {
  const progress1 = JSON.stringify({
    type: "progress", percent: 50, message: "[1/2]",
    result: { params: { zscore_window: 10 }, metric: 0.8 },
  });
  const progress2 = JSON.stringify({
    type: "progress", percent: 100, message: "[2/2]",
    result: { params: { zscore_window: 20 }, metric: 1.5 },
  });
  const completeEvent = JSON.stringify({
    type: "complete",
    results: [
      { params: { zscore_window: 10 }, metric: 0.8 },
      { params: { zscore_window: 20 }, metric: 1.5 },
    ],
  });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    body: makeSseStream([progress1, progress2, completeEvent]),
  });

  const { result } = renderHook(() => useOptimizeStream());
  act(() => { void result.current.startOptimize(makeConfig()); });

  await waitFor(() => expect(result.current.status).toBe("completed"));
  expect(result.current.results).toHaveLength(2);
});
```

And testing the authoritative override:

```typescript
it("complete event overrides accumulated partial results", async () => {
  const progress1 = JSON.stringify({
    type: "progress", percent: 50,
    result: { params: { zscore_window: 10 }, metric: 0.8 },
  });
  const completeEvent = JSON.stringify({
    type: "complete",
    results: [
      { params: { zscore_window: 10 }, metric: 0.85 },   // different value!
      { params: { zscore_window: 20 }, metric: 1.5 },
    ],
  });

  // ... setup fetch mock ...

  await waitFor(() => expect(result.current.status).toBe("completed"));
  // Final results should be from complete event, not accumulated
  expect(result.current.results![0].metric).toBe(0.85);
});
```

---

## What Broke and How We Fixed It

### Bug: `.test.ts` File With JSX

When writing the `useBacktestStream` test, we initially created the file as `useBacktestStream.test.ts` (not `.tsx`). The wrapper function used `<Provider store={store}>{children}</Provider>` — JSX syntax — which TypeScript refuses inside a `.ts` file.

**Symptoms:** `tsc --noEmit` reported overload errors on `Provider` — confusingly, the error message talked about missing `children` props, not about JSX syntax. This is because TypeScript tried to interpret the JSX as a generic type expression and failed.

**Fix:** Rename the file to `.test.tsx`. In Vitest / TypeScript projects, any file using JSX needs the `.tsx` extension — this is a compile-time switch, not a runtime one. The `.tsx` extension tells the TypeScript compiler to enable JSX parsing for that file.

**General lesson:** When you see confusing "no overload matches" or "children is missing" errors in React test files, check the file extension first.

### Bug: Unused Import Warning

After renaming to `.tsx`, ESLint flagged `waitFor` as unused — we'd imported it from `@testing-library/react` but never called it (the `useBacktestStream` tests use synchronous `act()` + `emitMessage()` since EventSource events are dispatched manually, not asynchronously resolved by the stream).

**Fix:** Remove the unused import. The `useOptimizeStream` tests *do* need `waitFor` because `fetch`-based streaming resolves asynchronously.

**General lesson:** EventSource mock tests are synchronous (you control when events fire), but Fetch mock tests are asynchronous (the `ReadableStream` resolves on its own schedule). This difference affects which testing utilities you need.

---

## Test Summary

| Suite | File | Tests | Key Coverage |
|-------|------|-------|-------------|
| Backend SSE | [test_sse_streaming.py](backend/tests/test_sse_streaming.py) | 17 | Content-type, event structure, progress ordering, complete results, progressive `result` field, error events, validation |
| Backtest Hook | [useBacktestStream.test.tsx](frontend/__tests__/hooks/useBacktestStream.test.tsx) | 14 | EventSource lifecycle, Redux dispatch, all 3 event types, abort/reconnect, malformed messages, server action failure |
| Optimize Hook | [useOptimizeStream.test.ts](frontend/__tests__/hooks/useOptimizeStream.test.ts) | 18 | Fetch + ReadableStream, progressive accumulation, complete overrides, abort/error, state reset |

**Running totals:** 415 frontend tests (38 files), 46 backend tests — all green.

---

## Key Takeaway

> Progressive streaming is a UX multiplier that requires surprisingly little code: attach each individual result to its progress SSE event, accumulate into a local array on the client, and widen the render condition from `completed` to `completed || running`. The real work is in the test infrastructure — mocking `EventSource`, synthetic `ReadableStream`s, and asserting on Redux stores — which, once built, makes the streaming pipeline as testable as any synchronous function.

---

**Next:** [Lesson 41 — Error Boundaries, Loading Skeletons, and Toast Notifications](./41-error-boundaries-loading-skeletons-toasts.md)

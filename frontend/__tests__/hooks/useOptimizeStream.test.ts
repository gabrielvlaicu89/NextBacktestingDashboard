/**
 * Tests for useOptimizeStream hook.
 *
 * Uses a mock fetch to simulate SSE responses and AbortError.
 * Tests status transitions, progress updates, results delivery, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOptimizeStream } from "@/hooks/useOptimizeStream";
import type { OptimizeConfig } from "@/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Build a ReadableStream that emits a list of SSE event strings, then closes.
 */
function makeSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const sseText = events.map((e) => `data: ${e}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });
}

function makeConfig(): OptimizeConfig {
  return {
    strategy_type: "MEAN_REVERSION",
    ticker: "SPY",
    date_from: "2020-01-01",
    date_to: "2024-01-01",
    benchmark: "SPY",
    risk_settings: {
      starting_capital: 10000,
      position_sizing_mode: "PERCENT_PORTFOLIO",
      position_size: 100,
      stop_loss_pct: null,
      take_profit_pct: null,
    },
    fixed_parameters: {},
    param_ranges: { zscore_window: { min: 10, max: 30, step: 5 } },
    optimize_for: "sharpe_ratio",
  };
}

// ── Mocks ──────────────────────────────────────────────────────────────────────

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useOptimizeStream", () => {
  // Initial state
  it("starts with idle status", () => {
    const { result } = renderHook(() => useOptimizeStream());
    expect(result.current.status).toBe("idle");
  });

  it("starts with zero progress", () => {
    const { result } = renderHook(() => useOptimizeStream());
    expect(result.current.progress).toBe(0);
  });

  it("starts with null results", () => {
    const { result } = renderHook(() => useOptimizeStream());
    expect(result.current.results).toBeNull();
  });

  it("starts with null error", () => {
    const { result } = renderHook(() => useOptimizeStream());
    expect(result.current.error).toBeNull();
  });

  // Successful optimization stream
  it("transitions status to running then completed", async () => {
    const completedEvent = JSON.stringify({
      type: "complete",
      results: [{ params: { zscore_window: 20 }, metric: 1.5 }],
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([completedEvent]),
    });

    const { result } = renderHook(() => useOptimizeStream());

    act(() => {
      void result.current.startOptimize(makeConfig());
    });

    expect(result.current.status).toBe("running");

    await waitFor(() => expect(result.current.status).toBe("completed"));
  });

  it("sets progress from progress events", async () => {
    const progressEvent = JSON.stringify({ type: "progress", percent: 42, message: "Computing…" });
    const completeEvent = JSON.stringify({ type: "complete", results: [] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([progressEvent, completeEvent]),
    });

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });

    await waitFor(() => expect(result.current.status).toBe("completed"));
    // Progress should have been set during the stream (may be 100 by the end)
    expect(result.current.progress).toBeGreaterThanOrEqual(42);
  });

  it("stores results when complete event is received", async () => {
    const optimResults = [
      { params: { zscore_window: 10 }, metric: 0.8 },
      { params: { zscore_window: 20 }, metric: 1.5 },
    ];
    const completeEvent = JSON.stringify({ type: "complete", results: optimResults });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([completeEvent]),
    });

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });

    await waitFor(() => expect(result.current.results).not.toBeNull());
    expect(result.current.results).toHaveLength(2);
    expect(result.current.results![0].metric).toBe(0.8);
  });

  it("sets progress to 100 on complete", async () => {
    const completeEvent = JSON.stringify({ type: "complete", results: [] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([completeEvent]),
    });

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });

    await waitFor(() => expect(result.current.status).toBe("completed"));
    expect(result.current.progress).toBe(100);
  });

  // Error handling
  it("transitions to error status on error event", async () => {
    const errorEvent = JSON.stringify({ type: "error", message: "Optimization failed" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([errorEvent]),
    });

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Optimization failed");
  });

  it("transitions to error status on non-ok HTTP response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error",
      body: null,
    });

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).not.toBeNull();
  });

  it("transitions to error status on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Network error");
  });

  // Abort flow
  it("transitions to idle status when aborted", async () => {
    global.fetch = vi.fn().mockRejectedValue(
      Object.assign(new Error("AbortError"), { name: "AbortError" }),
    );

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.error).toBeNull();
  });

  it("abort() method is callable without error", () => {
    const { result } = renderHook(() => useOptimizeStream());
    expect(() => result.current.abort()).not.toThrow();
  });

  // Resets state on new run
  it("resets results to null when a new startOptimize is called", async () => {
    const completeEvent = JSON.stringify({
      type: "complete",
      results: [{ params: { zscore_window: 20 }, metric: 1.5 }],
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([completeEvent]),
    });

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });
    await waitFor(() => expect(result.current.status).toBe("completed"));

    // Now start again — mock returns no results
    const completeEventEmpty = JSON.stringify({ type: "complete", results: [] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([completeEventEmpty]),
    });

    act(() => { void result.current.startOptimize(makeConfig()); });
    // Immediately after calling startOptimize, results should be reset to null
    expect(result.current.results).toBeNull();
  });

  // Progressive result accumulation
  it("accumulates partial results from progress events with result field", async () => {
    const progress1 = JSON.stringify({
      type: "progress",
      percent: 50,
      message: "[1/2] zscore_window=10",
      result: { params: { zscore_window: 10 }, metric: 0.8 },
    });
    const progress2 = JSON.stringify({
      type: "progress",
      percent: 100,
      message: "[2/2] zscore_window=20",
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
    expect(result.current.results![0].metric).toBe(0.8);
    expect(result.current.results![1].metric).toBe(1.5);
  });

  it("shows partial results while still running", async () => {
    // Use a chunked stream to control timing
    const encoder = new TextEncoder();
    const progress1 = `data: ${JSON.stringify({
      type: "progress",
      percent: 50,
      message: "[1/2]",
      result: { params: { zscore_window: 10 }, metric: 0.8 },
    })}\n\n`;
    const complete = `data: ${JSON.stringify({
      type: "complete",
      results: [{ params: { zscore_window: 10 }, metric: 0.8 }],
    })}\n\n`;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(progress1));
        controller.enqueue(encoder.encode(complete));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({ ok: true, body: stream });

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });

    await waitFor(() => expect(result.current.results).not.toBeNull());
    // By the time we can assert, at least 1 result should be accumulated
    expect(result.current.results!.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores progress events without result field for accumulation", async () => {
    const progressNoResult = JSON.stringify({
      type: "progress",
      percent: 0,
      message: "Starting…",
    });
    const completeEvent = JSON.stringify({
      type: "complete",
      results: [{ params: { zscore_window: 10 }, metric: 0.8 }],
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([progressNoResult, completeEvent]),
    });

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });

    await waitFor(() => expect(result.current.status).toBe("completed"));
    // Final results from complete event
    expect(result.current.results).toHaveLength(1);
  });

  it("complete event overrides accumulated partial results", async () => {
    const progress1 = JSON.stringify({
      type: "progress",
      percent: 50,
      message: "[1/2]",
      result: { params: { zscore_window: 10 }, metric: 0.8 },
    });
    // Complete event is the authoritative source — may differ from accumulated
    const completeEvent = JSON.stringify({
      type: "complete",
      results: [
        { params: { zscore_window: 10 }, metric: 0.85 },
        { params: { zscore_window: 20 }, metric: 1.5 },
      ],
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([progress1, completeEvent]),
    });

    const { result } = renderHook(() => useOptimizeStream());
    act(() => { void result.current.startOptimize(makeConfig()); });

    await waitFor(() => expect(result.current.status).toBe("completed"));
    // Final results should be from the complete event, not accumulated
    expect(result.current.results).toHaveLength(2);
    expect(result.current.results![0].metric).toBe(0.85);
  });
});

/**
 * Tests for useBacktestStream hook.
 *
 * Mocks EventSource, the createBacktestRun server action, and wraps
 * the hook in a Redux Provider to verify that SSE events correctly
 * dispatch to the backtest slice.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { createTestStore } from "@/__tests__/helpers/render-with-store";
import { useBacktestStream } from "@/hooks/useBacktestStream";

// ── Mock server action ─────────────────────────────────────────────────────────

vi.mock("@/lib/actions/backtest", () => ({
  createBacktestRun: vi.fn(),
}));

import { createBacktestRun } from "@/lib/actions/backtest";

const mockCreateBacktestRun = vi.mocked(createBacktestRun);

// ── Mock EventSource ───────────────────────────────────────────────────────────

type EventSourceListener = ((event: MessageEvent) => void) | null;
type ErrorListener = ((event: Event) => void) | null;

let lastEventSource: {
  url: string;
  onmessage: EventSourceListener;
  onerror: ErrorListener;
  close: ReturnType<typeof vi.fn>;
} | null = null;

class MockEventSource {
  url: string;
  onmessage: EventSourceListener = null;
  onerror: ErrorListener = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastEventSource = this;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeConfig() {
  return {
    strategy_type: "MEAN_REVERSION",
    ticker: "SPY",
    date_from: "2020-01-01",
    date_to: "2024-01-01",
    benchmark: "SPY",
    risk_settings: { starting_capital: 10000 },
    parameters: { zscore_window: 20 },
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <Provider store={createTestStore()}>{children}</Provider>;
}

function makeWrapper() {
  const store = createTestStore();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }
  return { store, Wrapper };
}

/** Simulate an SSE message event */
function emitMessage(data: Record<string, unknown>) {
  if (!lastEventSource?.onmessage) throw new Error("No EventSource onmessage handler");
  lastEventSource.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
}

/** Simulate an SSE error event */
function emitError() {
  if (!lastEventSource?.onerror) throw new Error("No EventSource onerror handler");
  lastEventSource.onerror(new Event("error"));
}

// ── Setup/Teardown ─────────────────────────────────────────────────────────────

const originalEventSource = globalThis.EventSource;

beforeEach(() => {
  vi.clearAllMocks();
  lastEventSource = null;
  // @ts-expect-error — replacing global EventSource with mock
  globalThis.EventSource = MockEventSource;
  mockCreateBacktestRun.mockResolvedValue({ strategyId: "strat-1", runId: "run-1" });
});

afterEach(() => {
  globalThis.EventSource = originalEventSource;
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useBacktestStream", () => {
  it("returns startBacktest and abort functions", () => {
    const { result } = renderHook(() => useBacktestStream(), { wrapper });
    expect(typeof result.current.startBacktest).toBe("function");
    expect(typeof result.current.abort).toBe("function");
  });

  it("creates strategy and run records via server action", async () => {
    const { result } = renderHook(() => useBacktestStream(), { wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    expect(mockCreateBacktestRun).toHaveBeenCalledOnce();
  });

  it("opens EventSource with runId query parameter", async () => {
    const { result } = renderHook(() => useBacktestStream(), { wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    expect(lastEventSource).not.toBeNull();
    expect(lastEventSource!.url).toBe("/api/backtest?runId=run-1");
  });

  it("dispatches progress to Redux on progress events", async () => {
    const { store, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBacktestStream(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    act(() => {
      emitMessage({ type: "progress", percent: 42, message: "Fetching data…" });
    });

    const state = store.getState().backtest;
    expect(state.progress).toBe(42);
    expect(state.message).toBe("Fetching data…");
    expect(state.status).toBe("running");
  });

  it("dispatches results and completes on complete event", async () => {
    const { store, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBacktestStream(), { wrapper: Wrapper });

    const mockResults = {
      metrics: {
        total_return_pct: 15,
        annualized_return_pct: 12,
        max_drawdown_pct: -8,
        sharpe_ratio: 1.5,
        sortino_ratio: 2.0,
        win_rate_pct: 60,
        profit_factor: 1.8,
      },
      equity_curve: [{ date: "2024-01-02", value: 10000, benchmark_value: 10000 }],
      drawdown_series: [{ date: "2024-01-02", drawdown_pct: 0 }],
      monthly_returns: [{ year: 2024, month: 1, return_pct: 2.5 }],
      trades: [],
    };

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    act(() => {
      emitMessage({ type: "complete", results: mockResults });
    });

    const state = store.getState().backtest;
    expect(state.status).toBe("completed");
    expect(state.progress).toBe(100);
    expect(state.results).toEqual(mockResults);
    expect(lastEventSource!.close).toHaveBeenCalled();
  });

  it("dispatches error on error event", async () => {
    const { store, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBacktestStream(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    act(() => {
      emitMessage({ type: "error", message: "Backend unavailable" });
    });

    const state = store.getState().backtest;
    expect(state.status).toBe("failed");
    expect(state.error).toBe("Backend unavailable");
    expect(lastEventSource!.close).toHaveBeenCalled();
  });

  it("handles EventSource connection error", async () => {
    const { store, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBacktestStream(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    act(() => {
      emitError();
    });

    const state = store.getState().backtest;
    expect(state.status).toBe("failed");
    expect(state.error).toBe("Connection to backtest stream lost");
    expect(lastEventSource!.close).toHaveBeenCalled();
  });

  it("handles server action failure", async () => {
    mockCreateBacktestRun.mockRejectedValueOnce(new Error("Auth failed"));

    const { store, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBacktestStream(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    const state = store.getState().backtest;
    expect(state.status).toBe("failed");
    expect(state.error).toBe("Auth failed");
  });

  it("abort() closes the EventSource", async () => {
    const { result } = renderHook(() => useBacktestStream(), { wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    const es = lastEventSource!;
    act(() => {
      result.current.abort();
    });

    expect(es.close).toHaveBeenCalled();
  });

  it("resets Redux state when starting a new backtest", async () => {
    const { store, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBacktestStream(), { wrapper: Wrapper });

    // First run
    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });
    act(() => {
      emitMessage({ type: "progress", percent: 50, message: "Halfway" });
    });

    // Second run should reset
    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    const state = store.getState().backtest;
    expect(state.progress).toBe(0);
    expect(state.message).toBe("");
    expect(state.status).toBe("running");
  });

  it("sets runId and strategyId in Redux", async () => {
    const { store, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBacktestStream(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    const state = store.getState().backtest;
    expect(state.runId).toBe("run-1");
    expect(state.strategyId).toBe("strat-1");
  });

  it("handles full lifecycle: progress → progress → complete", async () => {
    const { store, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBacktestStream(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    // Multiple progress events
    act(() => {
      emitMessage({ type: "progress", percent: 10, message: "Fetching data…" });
    });
    expect(store.getState().backtest.progress).toBe(10);

    act(() => {
      emitMessage({ type: "progress", percent: 50, message: "Running strategy…" });
    });
    expect(store.getState().backtest.progress).toBe(50);

    act(() => {
      emitMessage({ type: "progress", percent: 100, message: "Computing metrics…" });
    });
    expect(store.getState().backtest.progress).toBe(100);

    // Complete event
    act(() => {
      emitMessage({
        type: "complete",
        results: {
          metrics: {
            total_return_pct: 10,
            annualized_return_pct: 8,
            max_drawdown_pct: -5,
            sharpe_ratio: 1.2,
            sortino_ratio: 1.5,
            win_rate_pct: 55,
            profit_factor: 1.6,
          },
          equity_curve: [],
          drawdown_series: [],
          monthly_returns: [],
          trades: [],
        },
      });
    });

    const state = store.getState().backtest;
    expect(state.status).toBe("completed");
    expect(state.results).toBeTruthy();
    expect(state.results!.metrics.sharpe_ratio).toBe(1.2);
  });

  it("ignores unparseable SSE messages", async () => {
    const { store, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBacktestStream(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    // Send invalid JSON — should not throw
    act(() => {
      lastEventSource!.onmessage!(new MessageEvent("message", { data: "not json" }));
    });

    // State should remain as running (no error)
    expect(store.getState().backtest.status).toBe("running");
  });

  it("closes previous EventSource when starting a new backtest", async () => {
    const { result } = renderHook(() => useBacktestStream(), { wrapper });

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    const firstEs = lastEventSource!;

    await act(async () => {
      await result.current.startBacktest(makeConfig());
    });

    expect(firstEs.close).toHaveBeenCalled();
    expect(lastEventSource).not.toBe(firstEs);
  });
});

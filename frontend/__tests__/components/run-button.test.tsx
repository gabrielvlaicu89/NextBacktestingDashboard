import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { RunButton } from "@/components/strategy-builder/run-button";
import { renderWithStore } from "@/__tests__/helpers/render-with-store";
import type { BacktestState } from "@/store/slices/backtestSlice";

describe("RunButton", () => {
  const onRun = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with 'Run Backtest' text when idle", () => {
    renderWithStore(<RunButton onRun={onRun} />);
    expect(screen.getByTestId("run-backtest-button")).toHaveTextContent(
      "Run Backtest"
    );
  });

  it("calls onRun when clicked", () => {
    renderWithStore(<RunButton onRun={onRun} />);
    fireEvent.click(screen.getByTestId("run-backtest-button"));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    renderWithStore(<RunButton onRun={onRun} disabled />);
    expect(screen.getByTestId("run-backtest-button")).toBeDisabled();
  });

  it("shows 'Running Backtest…' when status is running", () => {
    renderWithStore(<RunButton onRun={onRun} />, {
      preloadedState: {
        backtest: {
          runId: null,
          strategyId: null,
          status: "running",
          progress: 25,
          message: "",
          results: null,
          error: null,
        } as BacktestState,
      },
    });
    expect(screen.getByTestId("run-backtest-button")).toHaveTextContent(
      "Running Backtest"
    );
  });

  it("is disabled when backtest is running", () => {
    renderWithStore(<RunButton onRun={onRun} />, {
      preloadedState: {
        backtest: {
          runId: null,
          strategyId: null,
          status: "running",
          progress: 0,
          message: "",
          results: null,
          error: null,
        } as BacktestState,
      },
    });
    expect(screen.getByTestId("run-backtest-button")).toBeDisabled();
  });

  it("shows spinner icon when running", () => {
    renderWithStore(<RunButton onRun={onRun} />, {
      preloadedState: {
        backtest: {
          runId: null,
          strategyId: null,
          status: "running",
          progress: 50,
          message: "",
          results: null,
          error: null,
        } as BacktestState,
      },
    });
    expect(
      screen.getByTestId("run-backtest-button").querySelector(".animate-spin")
    ).toBeInTheDocument();
  });

  it("is not disabled when status is completed", () => {
    renderWithStore(<RunButton onRun={onRun} />, {
      preloadedState: {
        backtest: {
          runId: "abc",
          strategyId: "xyz",
          status: "completed",
          progress: 100,
          message: "",
          results: null,
          error: null,
        } as BacktestState,
      },
    });
    expect(screen.getByTestId("run-backtest-button")).not.toBeDisabled();
  });
});

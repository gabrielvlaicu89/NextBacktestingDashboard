/**
 * Tests for BacktestProgressBar component.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BacktestProgressBar } from "@/components/results/backtest-progress-bar";

describe("BacktestProgressBar", () => {
  it("renders the progress bar container", () => {
    render(<BacktestProgressBar progress={50} message="Running strategy…" />);
    expect(screen.getByTestId("backtest-progress")).toBeInTheDocument();
  });

  it("displays the progress message", () => {
    render(<BacktestProgressBar progress={30} message="Fetching market data…" />);
    expect(screen.getByTestId("progress-message")).toHaveTextContent("Fetching market data…");
  });

  it("displays default message when empty", () => {
    render(<BacktestProgressBar progress={0} message="" />);
    expect(screen.getByTestId("progress-message")).toHaveTextContent("Starting…");
  });

  it("displays the progress percentage", () => {
    render(<BacktestProgressBar progress={42} message="Running…" />);
    expect(screen.getByTestId("progress-percent")).toHaveTextContent("42%");
  });

  it("rounds the progress percentage", () => {
    render(<BacktestProgressBar progress={33.7} message="Running…" />);
    expect(screen.getByTestId("progress-percent")).toHaveTextContent("34%");
  });

  it("renders the progress bar element", () => {
    render(<BacktestProgressBar progress={75} message="Computing metrics…" />);
    expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
  });
});

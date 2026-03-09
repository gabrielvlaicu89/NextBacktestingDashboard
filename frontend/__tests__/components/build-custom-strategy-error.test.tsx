import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BuildCustomStrategyError from "@/app/dashboard/build-custom-stratergy/error";

describe("BuildCustomStrategyError", () => {
  it("renders the custom builder error heading", () => {
    const error = Object.assign(new Error("Draft fetch failed"), { digest: undefined });
    render(<BuildCustomStrategyError error={error} reset={() => {}} />);

    expect(screen.getByText("Failed to load custom builder")).toBeInTheDocument();
  });

  it("renders the provided error message", () => {
    const error = Object.assign(new Error("Draft fetch failed"), { digest: undefined });
    render(<BuildCustomStrategyError error={error} reset={() => {}} />);

    expect(screen.getByText("Draft fetch failed")).toBeInTheDocument();
  });

  it("falls back to the default message when the error message is empty", () => {
    const error = Object.assign(new Error(""), { digest: undefined });
    render(<BuildCustomStrategyError error={error} reset={() => {}} />);

    expect(
      screen.getByText("Could not load your saved custom strategy drafts."),
    ).toBeInTheDocument();
  });

  it("calls reset when Try again is clicked", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    const error = Object.assign(new Error("Draft fetch failed"), { digest: undefined });
    render(<BuildCustomStrategyError error={error} reset={reset} />);

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders a back link to the new backtest page", () => {
    const error = Object.assign(new Error("Draft fetch failed"), { digest: undefined });
    render(<BuildCustomStrategyError error={error} reset={() => {}} />);

    expect(screen.getByRole("link", { name: /back to new backtest/i })).toHaveAttribute(
      "href",
      "/dashboard/new",
    );
  });
});
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GlobalError from "@/app/error";

describe("GlobalError (root error boundary)", () => {
  it("renders the error message", () => {
    const error = Object.assign(new Error("Test boom"), { digest: undefined });
    render(<GlobalError error={error} reset={() => {}} />);
    expect(screen.getByText("Test boom")).toBeInTheDocument();
  });

  it("renders a fallback when error.message is empty", () => {
    const error = Object.assign(new Error(""), { digest: undefined });
    render(<GlobalError error={error} reset={() => {}} />);
    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  });

  it("renders a 'Try again' button", () => {
    const error = Object.assign(new Error("fail"), { digest: undefined });
    render(<GlobalError error={error} reset={() => {}} />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("calls reset when 'Try again' is clicked", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    const error = Object.assign(new Error("fail"), { digest: undefined });
    render(<GlobalError error={error} reset={reset} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders the heading", () => {
    const error = Object.assign(new Error("x"), { digest: undefined });
    render(<GlobalError error={error} reset={() => {}} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});

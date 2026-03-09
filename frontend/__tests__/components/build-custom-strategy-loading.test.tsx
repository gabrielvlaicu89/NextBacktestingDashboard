import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import BuildCustomStrategyLoading from "@/app/dashboard/build-custom-stratergy/loading";

describe("BuildCustomStrategyLoading", () => {
  it("renders without crashing", () => {
    const { container } = render(<BuildCustomStrategyLoading />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders multiple skeleton placeholders", () => {
    const { container } = render(<BuildCustomStrategyLoading />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it("includes the workspace layout grids", () => {
    render(<BuildCustomStrategyLoading />);
    expect(screen.getByTestId("build-custom-strategy-loading-main-column")).toBeInTheDocument();
    expect(screen.getByTestId("build-custom-strategy-loading-rule-grid")).toBeInTheDocument();
    expect(screen.getByTestId("build-custom-strategy-loading-sidebar")).toBeInTheDocument();
  });
});
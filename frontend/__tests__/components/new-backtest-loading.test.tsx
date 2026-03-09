import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import NewBacktestLoading from "@/app/dashboard/new/loading";

describe("NewBacktestLoading skeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<NewBacktestLoading />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders skeleton elements", () => {
    const { container } = render(<NewBacktestLoading />);
    const skelDivs = container.querySelectorAll("[data-slot='skeleton']");
    expect(skelDivs.length).toBeGreaterThan(5);
  });

  it("has responsive date range grid", () => {
    const { container } = render(<NewBacktestLoading />);
    const grids = container.querySelectorAll(".sm\\:grid-cols-2");
    expect(grids.length).toBeGreaterThanOrEqual(1);
  });

  it("has responsive strategy type grid", () => {
    const { container } = render(<NewBacktestLoading />);
    const grids = container.querySelectorAll(".lg\\:grid-cols-3");
    expect(grids.length).toBeGreaterThanOrEqual(1);
  });
});

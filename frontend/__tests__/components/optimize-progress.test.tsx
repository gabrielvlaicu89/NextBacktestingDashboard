/**
 * Tests for OptimizeProgress component.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OptimizeProgress } from "@/components/optimization/optimize-progress";

describe("OptimizeProgress", () => {
  it("renders nothing when status is idle", () => {
    render(<OptimizeProgress status="idle" progress={0} message="" />);
    expect(screen.queryByTestId("optimize-progress")).not.toBeInTheDocument();
  });

  it("renders nothing when status is completed", () => {
    render(<OptimizeProgress status="completed" progress={100} message="Done" />);
    expect(screen.queryByTestId("optimize-progress")).not.toBeInTheDocument();
  });

  it("renders nothing when status is error", () => {
    render(<OptimizeProgress status="error" progress={50} message="Failed" />);
    expect(screen.queryByTestId("optimize-progress")).not.toBeInTheDocument();
  });

  it("renders the progress container when status is running", () => {
    render(<OptimizeProgress status="running" progress={50} message="Computing…" />);
    expect(screen.getByTestId("optimize-progress")).toBeInTheDocument();
  });

  it("displays the rounded progress percentage", () => {
    render(<OptimizeProgress status="running" progress={42.7} message="" />);
    expect(screen.getByText("43%")).toBeInTheDocument();
  });

  it("displays the progress message", () => {
    render(<OptimizeProgress status="running" progress={30} message="Testing window=20" />);
    expect(screen.getByTestId("optimize-progress-message")).toHaveTextContent("Testing window=20");
  });

  it("does not render the message element when message is empty", () => {
    render(<OptimizeProgress status="running" progress={10} message="" />);
    expect(screen.queryByTestId("optimize-progress-message")).not.toBeInTheDocument();
  });

  it("shows 'Optimizing…' label when running", () => {
    render(<OptimizeProgress status="running" progress={0} message="Starting" />);
    expect(screen.getByText("Optimizing…")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategyTypeSelector } from "@/components/strategy-builder/strategy-type-selector";
import { STRATEGY_CATALOG } from "@/lib/strategy-catalog";
import type { StrategyType } from "@/lib/types";

describe("StrategyTypeSelector", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Strategy Type label", () => {
    render(<StrategyTypeSelector value={null} onChange={onChange} />);
    expect(screen.getByText("Strategy Type")).toBeInTheDocument();
  });

  it("renders a card for each strategy in the catalog", () => {
    render(<StrategyTypeSelector value={null} onChange={onChange} />);
    for (const item of STRATEGY_CATALOG) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
  });

  it("renders exactly 5 strategy cards", () => {
    render(<StrategyTypeSelector value={null} onChange={onChange} />);
    const buttons = screen.getAllByRole("radio");
    expect(buttons).toHaveLength(5);
  });

  it("shows descriptions for each strategy", () => {
    render(<StrategyTypeSelector value={null} onChange={onChange} />);
    for (const item of STRATEGY_CATALOG) {
      expect(screen.getByText(item.description)).toBeInTheDocument();
    }
  });

  it("marks selected strategy with aria-checked=true", () => {
    render(
      <StrategyTypeSelector value="MEAN_REVERSION" onChange={onChange} />
    );
    const selected = screen.getByTestId("strategy-card-MEAN_REVERSION");
    expect(selected).toHaveAttribute("aria-checked", "true");
  });

  it("marks non-selected strategies with aria-checked=false", () => {
    render(
      <StrategyTypeSelector value="MEAN_REVERSION" onChange={onChange} />
    );
    const other = screen.getByTestId("strategy-card-MA_CROSSOVER");
    expect(other).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange when a card is clicked", () => {
    render(<StrategyTypeSelector value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("strategy-card-MA_CROSSOVER"));
    expect(onChange).toHaveBeenCalledWith("MA_CROSSOVER");
  });

  it("calls onChange with correct type for each card click", () => {
    render(<StrategyTypeSelector value={null} onChange={onChange} />);
    const types: StrategyType[] = [
      "MEAN_REVERSION",
      "MA_CROSSOVER",
      "EARNINGS_DRIFT",
      "PAIRS_TRADING",
      "BUY_AND_HOLD",
    ];
    for (const type of types) {
      fireEvent.click(screen.getByTestId(`strategy-card-${type}`));
    }
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it("disables all cards when disabled=true", () => {
    render(
      <StrategyTypeSelector value={null} onChange={onChange} disabled />
    );
    const buttons = screen.getAllByRole("radio");
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });

  it("has radiogroup role on container", () => {
    render(<StrategyTypeSelector value={null} onChange={onChange} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("applies selected styling class to chosen card", () => {
    render(
      <StrategyTypeSelector value="BUY_AND_HOLD" onChange={onChange} />
    );
    const card = screen.getByTestId("strategy-card-BUY_AND_HOLD");
    const classes = card.className.split(/\s+/);
    expect(classes).toContain("border-primary");
  });

  it("does not apply selected styling to non-selected cards", () => {
    render(
      <StrategyTypeSelector value="BUY_AND_HOLD" onChange={onChange} />
    );
    const card = screen.getByTestId("strategy-card-MEAN_REVERSION");
    const classes = card.className.split(/\s+/);
    expect(classes).not.toContain("border-primary");
  });
});

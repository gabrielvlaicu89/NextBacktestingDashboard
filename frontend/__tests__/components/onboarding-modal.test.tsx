import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  OnboardingModal,
  STRATEGY_TEMPLATES,
} from "@/components/strategy-builder/onboarding-modal";
import { renderWithStore } from "@/__tests__/helpers/render-with-store";

describe("OnboardingModal", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal when open=true", () => {
    renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    expect(screen.getByTestId("onboarding-modal")).toBeInTheDocument();
  });

  it("does not render modal content when open=false", () => {
    renderWithStore(
      <OnboardingModal open={false} onOpenChange={onOpenChange} />
    );
    expect(screen.queryByTestId("onboarding-modal")).not.toBeInTheDocument();
  });

  it("renders the welcome title", () => {
    renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    expect(
      screen.getByText(/Welcome! Pick a template to get started/i)
    ).toBeInTheDocument();
  });

  it("renders the description text", () => {
    renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    expect(
      screen.getByText(/Choose a pre-built strategy/i)
    ).toBeInTheDocument();
  });

  it("renders the template list", () => {
    renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    expect(screen.getByTestId("template-list")).toBeInTheDocument();
  });

  it("renders all strategy templates", () => {
    renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    for (const template of STRATEGY_TEMPLATES) {
      expect(screen.getByText(template.title)).toBeInTheDocument();
    }
  });

  it("renders template descriptions", () => {
    renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    for (const template of STRATEGY_TEMPLATES) {
      expect(screen.getByText(template.description)).toBeInTheDocument();
    }
  });

  it("renders exactly 3 templates", () => {
    expect(STRATEGY_TEMPLATES).toHaveLength(3);
    renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    const buttons = screen.getByTestId("template-list").querySelectorAll("button");
    expect(buttons).toHaveLength(3);
  });

  it("dispatches prefillFromStrategy and closes when a template is clicked", () => {
    const { store } = renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    const template = STRATEGY_TEMPLATES[0]; // SPY Mean Reversion
    fireEvent.click(screen.getByTestId(`template-${template.strategyType}`));

    // Verify Redux state was updated
    const state = store.getState().strategyBuilder;
    expect(state.ticker).toBe(template.ticker);
    expect(state.strategyType).toBe(template.strategyType);
    expect(state.dateFrom).toBe(template.dateFrom);
    expect(state.dateTo).toBe(template.dateTo);
    expect(state.name).toBe(template.name);
    expect(state.benchmark).toBe(template.benchmark);
    expect(state.parameters).toEqual(template.parameters);

    // Verify modal was closed
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("fills MA Crossover template when clicked", () => {
    const { store } = renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    const template = STRATEGY_TEMPLATES[1]; // AAPL MA Crossover
    fireEvent.click(screen.getByTestId(`template-${template.strategyType}`));

    const state = store.getState().strategyBuilder;
    expect(state.ticker).toBe("AAPL");
    expect(state.strategyType).toBe("MA_CROSSOVER");
    expect(state.parameters).toEqual({
      fast_period: 10,
      slow_period: 50,
      ma_type: "EMA",
    });
  });

  it("fills Earnings Drift template when clicked", () => {
    const { store } = renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    const template = STRATEGY_TEMPLATES[2]; // MSFT Earnings Drift
    fireEvent.click(screen.getByTestId(`template-${template.strategyType}`));

    const state = store.getState().strategyBuilder;
    expect(state.ticker).toBe("MSFT");
    expect(state.strategyType).toBe("EARNINGS_DRIFT");
    expect(state.name).toBe("MSFT Earnings Drift");
  });

  it("each template has data-testid with strategy type", () => {
    renderWithStore(
      <OnboardingModal open={true} onOpenChange={onOpenChange} />
    );
    for (const template of STRATEGY_TEMPLATES) {
      expect(
        screen.getByTestId(`template-${template.strategyType}`)
      ).toBeInTheDocument();
    }
  });

  it("templates contain expected strategy types", () => {
    const types = STRATEGY_TEMPLATES.map((t) => t.strategyType);
    expect(types).toContain("MEAN_REVERSION");
    expect(types).toContain("MA_CROSSOVER");
    expect(types).toContain("EARNINGS_DRIFT");
  });

  it("all templates use DEFAULT_RISK_SETTINGS", () => {
    for (const template of STRATEGY_TEMPLATES) {
      expect(template.riskSettings.starting_capital).toBe(10000);
      expect(template.riskSettings.position_sizing_mode).toBe(
        "PERCENT_PORTFOLIO"
      );
    }
  });
});

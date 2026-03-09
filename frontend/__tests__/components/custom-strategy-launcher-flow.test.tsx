import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrategyBuilderForm } from "@/components/strategy-builder/strategy-builder-form";
import { SavedCustomStrategiesSection } from "@/components/custom-strategy/saved-custom-strategies-section";
import { renderWithStore } from "@/__tests__/helpers/render-with-store";
import type { CustomStrategyDefinitionRecord } from "@/lib/types";

const mockStartBacktest = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/useTickerSearch", () => ({
  useTickerSearch: () => ({
    query: "",
    setQuery: vi.fn(),
    results: [],
    loading: false,
  }),
}));

vi.mock("@/hooks/useBacktestStream", () => ({
  useBacktestStream: () => ({
    startBacktest: mockStartBacktest,
    abort: vi.fn(),
  }),
}));

const savedDefinition: CustomStrategyDefinitionRecord = {
  id: "custom-1",
  userId: "user-1",
  name: "RSI Draft",
  description: "Draft strategy based on RSI.",
  definitionVersion: 1,
  definition: {
    version: 1,
    name: "RSI Draft",
    description: "Draft strategy based on RSI.",
    indicators: [],
    longEntry: {
      type: "group",
      operator: "AND",
      conditions: [
        {
          type: "condition",
          left: { kind: "price", field: "CLOSE" },
          comparator: ">",
          right: { kind: "constant", value: 100 },
        },
      ],
    },
    longExit: {
      type: "group",
      operator: "AND",
      conditions: [
        {
          type: "condition",
          left: { kind: "price", field: "CLOSE" },
          comparator: "<",
          right: { kind: "constant", value: 99 },
        },
      ],
    },
    shortEntry: { type: "group", operator: "AND", conditions: [] },
    shortExit: { type: "group", operator: "AND", conditions: [] },
  },
  tags: ["daily", "mean-reversion"],
  createdAt: "2026-03-09T10:00:00.000Z",
  updatedAt: "2026-03-09T11:00:00.000Z",
};

describe("Custom strategy launcher flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("loads a saved custom draft into launcher runtime review mode and runs it", async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(
      <>
        <StrategyBuilderForm />
        <SavedCustomStrategiesSection definitions={[savedDefinition]} />
      </>,
      {
        preloadedState: {
          strategyBuilder: {
            name: "",
            ticker: "SPY",
            dateFrom: "2024-01-01",
            dateTo: "2024-12-31",
            builderMode: "BUILT_IN",
            strategyType: "MEAN_REVERSION",
            parameters: {},
            customStrategy: savedDefinition.definition,
            riskSettings: {
              starting_capital: 10000,
              position_sizing_mode: "PERCENT_PORTFOLIO",
              position_size: 100,
              stop_loss_pct: null,
              take_profit_pct: null,
            },
            benchmark: "SPY",
            tags: [],
          },
        },
      },
    );

    await user.click(screen.getByTestId("launch-custom-strategy-custom-1"));

    const builder = store.getState().strategyBuilder;
    expect(builder.builderMode).toBe("CUSTOM");
    expect(builder.customStrategy).toEqual(savedDefinition.definition);
    expect(builder.name).toBe("RSI Draft");
    expect(builder.tags).toEqual(["daily", "mean-reversion"]);

    expect(screen.getByTestId("custom-strategy-runtime-summary")).toBeInTheDocument();
    expect(screen.getByTestId("selected-custom-strategy-name")).toHaveTextContent(
      "RSI Draft",
    );
    expect(screen.getByTestId("custom-strategy-runtime-notice")).toHaveTextContent(
      /supports long-entry and long-exit rules/i,
    );

    await user.click(screen.getByTestId("run-backtest-button"));

    expect(mockStartBacktest).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy_type: "CUSTOM",
        ticker: "SPY",
        date_from: "2024-01-01",
        date_to: "2024-12-31",
        parameters: {
          custom_definition: savedDefinition.definition,
        },
      }),
    );
  });

  it("shows runtime blockers for unsupported short-side custom drafts", async () => {
    const user = userEvent.setup();
    const invalidDefinition: CustomStrategyDefinitionRecord = {
      ...savedDefinition,
      id: "custom-2",
      definition: {
        ...savedDefinition.definition,
        shortEntry: {
          type: "group",
          operator: "AND",
          conditions: [
            {
              type: "condition",
              left: { kind: "price", field: "CLOSE" },
              comparator: "<",
              right: { kind: "constant", value: 98 },
            },
          ],
        },
      },
    };

    renderWithStore(
      <>
        <StrategyBuilderForm />
        <SavedCustomStrategiesSection definitions={[invalidDefinition]} />
      </>,
    );

    await user.click(screen.getByTestId("launch-custom-strategy-custom-2"));
    await user.click(screen.getByTestId("run-backtest-button"));

    expect(mockStartBacktest).not.toHaveBeenCalled();
    expect(screen.getByTestId("custom-strategy-runtime-errors")).toHaveTextContent(
      /long-entry and long-exit rules only/i,
    );
  });

  it("shows shared field validation errors for custom runs before starting the backtest", async () => {
    const user = userEvent.setup();

    renderWithStore(
      <>
        <StrategyBuilderForm />
        <SavedCustomStrategiesSection definitions={[savedDefinition]} />
      </>,
      {
        preloadedState: {
          strategyBuilder: {
            name: "",
            ticker: "",
            dateFrom: "2024-12-31",
            dateTo: "2024-01-01",
            builderMode: "BUILT_IN",
            strategyType: "MEAN_REVERSION",
            parameters: {},
            customStrategy: savedDefinition.definition,
            riskSettings: {
              starting_capital: 10000,
              position_sizing_mode: "PERCENT_PORTFOLIO",
              position_size: 100,
              stop_loss_pct: null,
              take_profit_pct: null,
            },
            benchmark: "SPY",
            tags: [],
          },
        },
      },
    );

    await user.click(screen.getByTestId("launch-custom-strategy-custom-1"));
    await user.click(screen.getByTestId("run-backtest-button"));

    expect(mockStartBacktest).not.toHaveBeenCalled();
    expect(screen.getByTestId("field-error-ticker")).toHaveTextContent(
      "Ticker is required",
    );
    expect(screen.getByTestId("field-error-date-to")).toHaveTextContent(
      "End date must be after start date",
    );
    expect(screen.getByTestId("validation-error")).toBeInTheDocument();
  });
});
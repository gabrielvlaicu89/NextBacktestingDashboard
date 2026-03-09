/**
 * Tests for Phase 11 — toast notifications, inline validation errors,
 * and edge case handling in the strategy builder.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrategyBuilderForm } from "@/components/strategy-builder/strategy-builder-form";
import { renderWithStore } from "@/__tests__/helpers/render-with-store";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/hooks/useTickerSearch", () => ({
  useTickerSearch: () => ({
    query: "",
    setQuery: vi.fn(),
    results: [],
    loading: false,
  }),
}));

const mockStartBacktest = vi.fn();
vi.mock("@/hooks/useBacktestStream", () => ({
  useBacktestStream: () => ({
    startBacktest: mockStartBacktest,
    abort: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StrategyBuilderForm — inline validation errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows inline ticker error when ticker is empty", async () => {
    const user = userEvent.setup();
    // Pre-load state: empty ticker, valid dates, valid strategy
    renderWithStore(<StrategyBuilderForm />, {
      preloadedState: {
        strategyBuilder: {
          name: "",
          ticker: "",
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
          strategyType: "MEAN_REVERSION",
          parameters: {},
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
    });

    await user.click(screen.getByTestId("run-backtest-button"));

    await waitFor(() => {
      expect(screen.getByTestId("field-error-ticker")).toBeInTheDocument();
    });
    expect(screen.getByTestId("field-error-ticker")).toHaveTextContent(
      "Ticker is required"
    );
  });

  it("shows inline date error when date_to < date_from", async () => {
    const user = userEvent.setup();
    renderWithStore(<StrategyBuilderForm />, {
      preloadedState: {
        strategyBuilder: {
          name: "",
          ticker: "SPY",
          dateFrom: "2024-12-31",
          dateTo: "2024-01-01",
          strategyType: "MEAN_REVERSION",
          parameters: {},
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
    });

    await user.click(screen.getByTestId("run-backtest-button"));

    await waitFor(() => {
      expect(screen.getByTestId("field-error-date-to")).toBeInTheDocument();
    });
    expect(screen.getByTestId("field-error-date-to")).toHaveTextContent(
      "End date must be after start date"
    );
  });

  it("shows validation error summary on validation failure", async () => {
    const user = userEvent.setup();
    renderWithStore(<StrategyBuilderForm />, {
      preloadedState: {
        strategyBuilder: {
          name: "",
          ticker: "",
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
          strategyType: "MEAN_REVERSION",
          parameters: {},
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
    });

    await user.click(screen.getByTestId("run-backtest-button"));

    await waitFor(() => {
      expect(screen.getByTestId("validation-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("validation-error")).toHaveTextContent(
      /Please fix.*validation/
    );
  });

  it("fires toast.error on validation failure", async () => {
    const user = userEvent.setup();
    renderWithStore(<StrategyBuilderForm />, {
      preloadedState: {
        strategyBuilder: {
          name: "",
          ticker: "",
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
          strategyType: "MEAN_REVERSION",
          parameters: {},
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
    });

    await user.click(screen.getByTestId("run-backtest-button"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Please fix the validation errors below"
      );
    });
  });

  it("clears field errors on reset", async () => {
    const user = userEvent.setup();
    renderWithStore(<StrategyBuilderForm />, {
      preloadedState: {
        strategyBuilder: {
          name: "",
          ticker: "",
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
          strategyType: "MEAN_REVERSION",
          parameters: {},
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
    });

    // Trigger validation errors
    await user.click(screen.getByTestId("run-backtest-button"));
    await waitFor(() => {
      expect(screen.getByTestId("validation-error")).toBeInTheDocument();
    });

    // Reset the form
    await user.click(screen.getByTestId("reset-builder-button"));

    // Validation errors should be cleared
    expect(screen.queryByTestId("validation-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("field-error-ticker")).not.toBeInTheDocument();
  });

  it("does not call startBacktest when validation fails", async () => {
    const user = userEvent.setup();
    renderWithStore(<StrategyBuilderForm />, {
      preloadedState: {
        strategyBuilder: {
          name: "",
          ticker: "",
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
          strategyType: "MEAN_REVERSION",
          parameters: {},
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
    });

    await user.click(screen.getByTestId("run-backtest-button"));
    expect(mockStartBacktest).not.toHaveBeenCalled();
  });
});

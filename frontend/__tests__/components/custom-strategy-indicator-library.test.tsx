import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomStrategyIndicatorLibrary } from "@/components/custom-strategy/custom-strategy-indicator-library";
import type { IndicatorNode } from "@/lib/types";

function StatefulLibraryHarness() {
  const [indicators, setIndicators] = useState<IndicatorNode[]>([
    {
      id: "rsi-1",
      indicatorId: "RSI",
      label: "RSI 14",
      params: { period: 14 },
    },
  ]);

  return (
    <CustomStrategyIndicatorLibrary
      indicators={indicators}
      onAddIndicator={vi.fn()}
      onRemoveIndicator={vi.fn()}
      onUpdateIndicatorLabel={(indicatorId, label) =>
        setIndicators((current) =>
          current.map((indicator) =>
            indicator.id === indicatorId ? { ...indicator, label } : indicator,
          ),
        )
      }
      onUpdateIndicatorParam={(indicatorId, key, value) =>
        setIndicators((current) =>
          current.map((indicator) =>
            indicator.id === indicatorId
              ? {
                  ...indicator,
                  params: {
                    ...indicator.params,
                    [key]: value,
                  },
                }
              : indicator,
          ),
        )
      }
    />
  );
}

describe("CustomStrategyIndicatorLibrary", () => {
  it("shows an empty state when no indicators are selected", () => {
    render(
      <CustomStrategyIndicatorLibrary
        indicators={[]}
        onAddIndicator={vi.fn()}
        onRemoveIndicator={vi.fn()}
        onUpdateIndicatorLabel={vi.fn()}
        onUpdateIndicatorParam={vi.fn()}
      />,
    );

    expect(screen.getByTestId("no-selected-indicators")).toHaveTextContent(
      "No indicators added yet",
    );
  });

  it("calls onAddIndicator when an indicator is added from the catalog", async () => {
    const user = userEvent.setup();
    const onAddIndicator = vi.fn();

    render(
      <CustomStrategyIndicatorLibrary
        indicators={[]}
        onAddIndicator={onAddIndicator}
        onRemoveIndicator={vi.fn()}
        onUpdateIndicatorLabel={vi.fn()}
        onUpdateIndicatorParam={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("add-indicator-RSI"));

    expect(onAddIndicator).toHaveBeenCalledWith("RSI");
  });

  it("filters the catalog using the search input", async () => {
    const user = userEvent.setup();

    render(
      <CustomStrategyIndicatorLibrary
        indicators={[]}
        onAddIndicator={vi.fn()}
        onRemoveIndicator={vi.fn()}
        onUpdateIndicatorLabel={vi.fn()}
        onUpdateIndicatorParam={vi.fn()}
      />,
    );

    await user.type(
      screen.getByTestId("custom-indicator-search-input"),
      "volatility",
    );

    expect(screen.getByTestId("indicator-catalog-card-BOLLINGER_BANDS")).toBeInTheDocument();
    expect(screen.queryByTestId("indicator-catalog-card-RSI")).not.toBeInTheDocument();
    expect(screen.queryByTestId("indicator-catalog-card-SMA")).not.toBeInTheDocument();
  });

  it("shows an empty state when the search has no matches", async () => {
    const user = userEvent.setup();

    render(
      <CustomStrategyIndicatorLibrary
        indicators={[]}
        onAddIndicator={vi.fn()}
        onRemoveIndicator={vi.fn()}
        onUpdateIndicatorLabel={vi.fn()}
        onUpdateIndicatorParam={vi.fn()}
      />,
    );

    await user.type(
      screen.getByTestId("custom-indicator-search-input"),
      "nonexistent-indicator",
    );

    expect(screen.getByTestId("indicator-search-empty-state")).toHaveTextContent(
      "No indicators match the current search.",
    );
  });

  it("lets users edit selected indicator labels and params", async () => {
    const user = userEvent.setup();

    render(<StatefulLibraryHarness />);

    const labelInput = screen.getByTestId("custom-indicator-label-rsi-1");
    await user.clear(labelInput);
    await user.type(labelInput, "RSI Swing");

    expect(screen.getByTestId("custom-indicator-label-rsi-1")).toHaveValue(
      "RSI Swing",
    );

    const periodInput = screen.getByTestId("custom-indicator-param-rsi-1-period");
    await user.clear(periodInput);
    await user.type(periodInput, "21");

    expect(screen.getByTestId("custom-indicator-param-rsi-1-period")).toHaveValue(
      21,
    );
  });

  it("calls onRemoveIndicator when a selected indicator is removed", async () => {
    const user = userEvent.setup();
    const onRemoveIndicator = vi.fn();

    render(
      <CustomStrategyIndicatorLibrary
        indicators={[
          {
            id: "rsi-1",
            indicatorId: "RSI",
            label: "RSI 14",
            params: { period: 14 },
          },
        ]}
        onAddIndicator={vi.fn()}
        onRemoveIndicator={onRemoveIndicator}
        onUpdateIndicatorLabel={vi.fn()}
        onUpdateIndicatorParam={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("remove-indicator-rsi-1"));

    expect(onRemoveIndicator).toHaveBeenCalledWith("rsi-1");
  });
});
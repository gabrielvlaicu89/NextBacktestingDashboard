import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { SavedCustomStrategiesSection } from "@/components/custom-strategy/saved-custom-strategies-section";
import { renderWithStore } from "@/__tests__/helpers/render-with-store";
import type { CustomStrategyDefinitionRecord } from "@/lib/types";

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
    longEntry: { type: "group", operator: "AND", conditions: [] },
    longExit: { type: "group", operator: "AND", conditions: [] },
    shortEntry: { type: "group", operator: "AND", conditions: [] },
    shortExit: { type: "group", operator: "AND", conditions: [] },
  },
  tags: ["daily"],
  createdAt: "2026-03-09T10:00:00.000Z",
  updatedAt: "2026-03-09T11:00:00.000Z",
};

describe("SavedCustomStrategiesSection", () => {
  it("renders the section heading and build link", () => {
    renderWithStore(<SavedCustomStrategiesSection definitions={[]} />);

    expect(screen.getByText("Saved Custom Strategies")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Build Custom Stratergy/i })).toHaveAttribute(
      "href",
      "/dashboard/build-custom-stratergy",
    );
  });

  it("renders an empty state when no definitions exist", () => {
    renderWithStore(<SavedCustomStrategiesSection definitions={[]} />);

    expect(screen.getByText("No saved custom strategies yet")).toBeInTheDocument();
  });

  it("renders saved definitions with launch and edit actions", () => {
    renderWithStore(<SavedCustomStrategiesSection definitions={[savedDefinition]} />);

    expect(screen.getByTestId("saved-custom-card-custom-1")).toBeInTheDocument();
    expect(screen.getByText("RSI Draft")).toBeInTheDocument();
    expect(
      screen.getByTestId("launch-custom-strategy-custom-1"),
    ).toHaveTextContent("Review Runtime Config");
    expect(screen.getByRole("link", { name: /Edit Draft/i })).toHaveAttribute(
      "href",
      "/dashboard/build-custom-stratergy?id=custom-1",
    );
    expect(screen.getByText("daily")).toBeInTheDocument();
  });
});
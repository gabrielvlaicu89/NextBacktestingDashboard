import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "@/__tests__/helpers/render-with-store";
import { CustomStrategyBuilderWorkspace } from "@/components/custom-strategy/custom-strategy-builder-workspace";
import type { CustomStrategyDefinitionRecord } from "@/lib/types";

vi.mock("@/lib/actions/custom-strategy-definitions", () => ({
  createCustomStrategyDefinition: vi.fn(),
  updateCustomStrategyDefinition: vi.fn(),
  deleteCustomStrategyDefinition: vi.fn(),
}));

import {
  createCustomStrategyDefinition,
  deleteCustomStrategyDefinition,
  updateCustomStrategyDefinition,
} from "@/lib/actions/custom-strategy-definitions";

const mockCreateCustomStrategyDefinition = vi.mocked(
  createCustomStrategyDefinition,
);
const mockUpdateCustomStrategyDefinition = vi.mocked(
  updateCustomStrategyDefinition,
);
const mockDeleteCustomStrategyDefinition = vi.mocked(
  deleteCustomStrategyDefinition,
);

function makeDefinition(
  overrides: Partial<CustomStrategyDefinitionRecord> = {},
): CustomStrategyDefinitionRecord {
  return {
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
    tags: [],
    createdAt: "2026-03-09T10:00:00.000Z",
    updatedAt: "2026-03-09T11:00:00.000Z",
    ...overrides,
  };
}

describe("CustomStrategyBuilderWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the custom builder heading and save button", () => {
    renderWithStore(
      <CustomStrategyBuilderWorkspace
        initialDefinitions={[]}
        initialDefinition={null}
      />,
    );

    expect(screen.getByText("Build Custom Stratergy")).toBeInTheDocument();
    expect(screen.getByTestId("save-custom-strategy-button")).toBeInTheDocument();
  });

  it("creates a new custom draft from the editor inputs", async () => {
    const user = userEvent.setup();
    const saved = makeDefinition({
      id: "custom-2",
      name: "My Saved Draft",
      description: "A custom strategy draft.",
      definition: {
        ...makeDefinition().definition,
        name: "My Saved Draft",
        description: "A custom strategy draft.",
      },
    });
    mockCreateCustomStrategyDefinition.mockResolvedValue(saved);

    renderWithStore(
      <CustomStrategyBuilderWorkspace
        initialDefinitions={[]}
        initialDefinition={null}
      />,
    );

    await user.type(
      screen.getByTestId("custom-strategy-name-input"),
      "My Saved Draft",
    );
    await user.type(
      screen.getByTestId("custom-strategy-description-input"),
      "A custom strategy draft.",
    );
    await user.click(screen.getByTestId("add-indicator-RSI"));
    const periodInput = screen.getByTestId(
      "custom-indicator-param-rsi-1-period",
    );
    await user.clear(periodInput);
    await user.type(periodInput, "21");
    await user.click(screen.getByTestId("save-custom-strategy-button"));

    await waitFor(() => {
      expect(mockCreateCustomStrategyDefinition).toHaveBeenCalledWith({
        definition: {
          version: 1,
          name: "My Saved Draft",
          description: "A custom strategy draft.",
          indicators: [
            {
              id: "rsi-1",
              indicatorId: "RSI",
              label: "RSI 14",
              params: { period: 21 },
            },
          ],
          longEntry: { type: "group", operator: "AND", conditions: [] },
          longExit: { type: "group", operator: "AND", conditions: [] },
          shortEntry: { type: "group", operator: "AND", conditions: [] },
          shortExit: { type: "group", operator: "AND", conditions: [] },
        },
        tags: [],
      });
    });

    expect(screen.getByTestId("custom-builder-status")).toHaveTextContent(
      "Custom strategy draft saved successfully.",
    );
  });

  it("loads a saved definition into the editor when Edit is clicked", async () => {
    const user = userEvent.setup();
    const definition = makeDefinition({
      definition: {
        ...makeDefinition().definition,
        indicators: [
          {
            id: "rsi-1",
            indicatorId: "RSI",
            label: "RSI 14",
            params: { period: 14 },
          },
        ],
      },
    });

    renderWithStore(
      <CustomStrategyBuilderWorkspace
        initialDefinitions={[definition]}
        initialDefinition={null}
      />,
    );

    await user.click(screen.getByTestId("edit-custom-definition-custom-1"));

    await waitFor(() => {
      expect(screen.getByTestId("custom-strategy-name-input")).toHaveValue(
        "RSI Draft",
      );
    });
    expect(screen.getByTestId("custom-strategy-description-input")).toHaveValue(
      "Draft strategy based on RSI.",
    );
    expect(screen.getByTestId("selected-indicator-row-rsi-1")).toBeInTheDocument();
  });

  it("updates an existing saved draft", async () => {
    const user = userEvent.setup();
    const definition = makeDefinition();
    mockUpdateCustomStrategyDefinition.mockResolvedValue(
      makeDefinition({
        name: "RSI Draft Updated",
        definition: {
          ...definition.definition,
          name: "RSI Draft Updated",
        },
      }),
    );

    renderWithStore(
      <CustomStrategyBuilderWorkspace
        initialDefinitions={[definition]}
        initialDefinition={definition}
      />,
    );

    const nameInput = screen.getByTestId("custom-strategy-name-input");
    await user.clear(nameInput);
    await user.type(nameInput, "RSI Draft Updated");
    await user.click(screen.getByTestId("save-custom-strategy-button"));

    await waitFor(() => {
      expect(mockUpdateCustomStrategyDefinition).toHaveBeenCalledWith(
        "custom-1",
        expect.objectContaining({
          definition: expect.objectContaining({ name: "RSI Draft Updated" }),
        }),
      );
    });
  });

  it("deletes the selected draft and clears the editor", async () => {
    const user = userEvent.setup();
    const definition = makeDefinition();
    mockDeleteCustomStrategyDefinition.mockResolvedValue(undefined as never);

    renderWithStore(
      <CustomStrategyBuilderWorkspace
        initialDefinitions={[definition]}
        initialDefinition={definition}
      />,
    );

    await user.click(screen.getByTestId("delete-custom-definition-custom-1"));

    await waitFor(() => {
      expect(mockDeleteCustomStrategyDefinition).toHaveBeenCalledWith("custom-1");
    });
    expect(screen.getByTestId("custom-draft-empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("custom-strategy-name-input")).toHaveValue("");
  });

  it("adds and removes indicators directly in the builder workspace", async () => {
    const user = userEvent.setup();

    renderWithStore(
      <CustomStrategyBuilderWorkspace
        initialDefinitions={[]}
        initialDefinition={null}
      />,
    );

    await user.click(screen.getByTestId("add-indicator-SMA"));
    expect(screen.getByTestId("selected-indicator-row-sma-1")).toBeInTheDocument();

    await user.click(screen.getByTestId("remove-indicator-sma-1"));
    expect(screen.getByTestId("no-selected-indicators")).toBeInTheDocument();
  });
});
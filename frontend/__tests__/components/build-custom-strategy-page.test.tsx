import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";
import BuildCustomStrategyPage from "@/app/dashboard/build-custom-stratergy/page";

vi.mock("@/components/custom-strategy/custom-strategy-builder-workspace", () => ({
  CustomStrategyBuilderWorkspace: vi.fn(() => null),
}));

vi.mock("@/lib/actions/custom-strategy-definitions", () => ({
  getCustomStrategyDefinitions: vi.fn(),
  getCustomStrategyDefinition: vi.fn(),
}));

import { CustomStrategyBuilderWorkspace } from "@/components/custom-strategy/custom-strategy-builder-workspace";
import {
  getCustomStrategyDefinition,
  getCustomStrategyDefinitions,
} from "@/lib/actions/custom-strategy-definitions";

const mockGetCustomStrategyDefinitions = vi.mocked(getCustomStrategyDefinitions);
const mockGetCustomStrategyDefinition = vi.mocked(getCustomStrategyDefinition);

function makeDefinition(id = "custom-1") {
  return {
    id,
    userId: "user-1",
    name: `Draft ${id}`,
    description: "Saved custom strategy draft.",
    definitionVersion: 1,
    definition: {
      version: 1 as const,
      name: `Draft ${id}`,
      description: "Saved custom strategy draft.",
      indicators: [],
      longEntry: { type: "group" as const, operator: "AND" as const, conditions: [] },
      longExit: { type: "group" as const, operator: "AND" as const, conditions: [] },
      shortEntry: { type: "group" as const, operator: "AND" as const, conditions: [] },
      shortExit: { type: "group" as const, operator: "AND" as const, conditions: [] },
    },
    tags: [],
    createdAt: "2026-03-09T10:00:00.000Z",
    updatedAt: "2026-03-09T10:00:00.000Z",
  };
}

describe("BuildCustomStrategyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes loaded definitions into the workspace", async () => {
    const definition = makeDefinition();
    mockGetCustomStrategyDefinitions.mockResolvedValue([definition]);

    const result = await BuildCustomStrategyPage({ searchParams: Promise.resolve({}) });

    expect(isValidElement(result)).toBe(true);
    if (isValidElement(result)) {
      expect(result.type).toBe(CustomStrategyBuilderWorkspace);
      expect(result.props).toMatchObject({
        initialDefinitions: [definition],
        initialDefinition: null,
      });
    }
  });

  it("uses a definition already present in the loaded list when an id query is provided", async () => {
    const definition = makeDefinition("custom-2");
    mockGetCustomStrategyDefinitions.mockResolvedValue([definition]);

    const result = await BuildCustomStrategyPage({
      searchParams: Promise.resolve({ id: "custom-2" }),
    });

    expect(mockGetCustomStrategyDefinition).not.toHaveBeenCalled();
    expect(isValidElement(result)).toBe(true);
    if (isValidElement(result)) {
      expect(result.props).toMatchObject({
        initialDefinitions: [definition],
        initialDefinition: definition,
      });
    }
  });

  it("fetches a requested definition when it is not in the loaded list", async () => {
    const definition = makeDefinition("custom-3");
    mockGetCustomStrategyDefinitions.mockResolvedValue([]);
    mockGetCustomStrategyDefinition.mockResolvedValue(definition);

    const result = await BuildCustomStrategyPage({
      searchParams: Promise.resolve({ id: "custom-3" }),
    });

    expect(mockGetCustomStrategyDefinition).toHaveBeenCalledWith("custom-3");
    expect(isValidElement(result)).toBe(true);
    if (isValidElement(result)) {
      expect(result.props).toMatchObject({
        initialDefinitions: [],
        initialDefinition: definition,
      });
    }
  });

  it("propagates definition list loading errors to the route error boundary", async () => {
    mockGetCustomStrategyDefinitions.mockRejectedValue(new Error("Unable to load drafts"));

    await expect(
      BuildCustomStrategyPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("Unable to load drafts");
  });
});
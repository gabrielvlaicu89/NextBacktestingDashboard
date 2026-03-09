import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRevalidatePath,
  mockRequireCurrentUser,
  mockFindMany,
  mockFindUnique,
  mockCreate,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockRequireCurrentUser: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/current-user", () => ({
  requireCurrentUser: mockRequireCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customStrategyDefinition: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

import {
  createCustomStrategyDefinition,
  deleteCustomStrategyDefinition,
  duplicateCustomStrategyDefinition,
  getCustomStrategyDefinition,
  getCustomStrategyDefinitions,
  updateCustomStrategyDefinition,
} from "@/lib/actions/custom-strategy-definitions";

function makeStoredRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "custom-1",
    userId: "user-1",
    name: "RSI Reversal",
    description: "Buys RSI recovery above 30.",
    definitionVersion: 1,
    definition: {
      version: 1,
      name: "RSI Reversal",
      description: "Buys RSI recovery above 30.",
      indicators: [
        {
          id: "rsi-1",
          indicatorId: "RSI",
          label: "RSI 14",
          params: { period: 14 },
        },
      ],
      longEntry: {
        type: "group",
        operator: "AND",
        conditions: [
          {
            type: "condition",
            left: { kind: "indicator", indicatorId: "rsi-1" },
            comparator: ">",
            right: { kind: "constant", value: 30 },
          },
        ],
      },
      longExit: {
        type: "group",
        operator: "AND",
        conditions: [
          {
            type: "condition",
            left: { kind: "indicator", indicatorId: "rsi-1" },
            comparator: ">=",
            right: { kind: "constant", value: 70 },
          },
        ],
      },
      shortEntry: {
        type: "group",
        operator: "AND",
        conditions: [
          {
            type: "condition",
            left: { kind: "indicator", indicatorId: "rsi-1" },
            comparator: "<",
            right: { kind: "constant", value: 70 },
          },
        ],
      },
      shortExit: {
        type: "group",
        operator: "AND",
        conditions: [
          {
            type: "condition",
            left: { kind: "indicator", indicatorId: "rsi-1" },
            comparator: "crosses_above",
            right: { kind: "constant", value: 50 },
          },
        ],
      },
    },
    tags: ["swing"],
    createdAt: new Date("2026-03-09T10:00:00.000Z"),
    updatedAt: new Date("2026-03-09T11:00:00.000Z"),
    ...overrides,
  };
}

describe("custom strategy definition actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  it("lists the current user's custom strategy definitions", async () => {
    mockFindMany.mockResolvedValue([makeStoredRecord()]);

    const result = await getCustomStrategyDefinitions();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { updatedAt: "desc" },
    });
    expect(result).toHaveLength(1);
    expect(result[0].definition.name).toBe("RSI Reversal");
    expect(result[0].createdAt).toBe("2026-03-09T10:00:00.000Z");
  });

  it("returns null when fetching a custom definition owned by another user", async () => {
    mockFindUnique.mockResolvedValue(makeStoredRecord({ userId: "user-2" }));

    const result = await getCustomStrategyDefinition("custom-1");

    expect(result).toBeNull();
  });

  it("creates a persisted custom definition using the definition name and description", async () => {
    const stored = makeStoredRecord();
    mockCreate.mockResolvedValue(stored);

    const result = await createCustomStrategyDefinition({
      definition: stored.definition,
      tags: ["swing", "daily"],
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        name: "RSI Reversal",
        description: "Buys RSI recovery above 30.",
        definitionVersion: 1,
        definition: stored.definition,
        tags: ["swing", "daily"],
      },
    });
    expect(result.name).toBe("RSI Reversal");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/new");
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      "/dashboard/build-custom-stratergy",
    );
  });

  it("updates a custom definition after ownership check", async () => {
    mockFindUnique.mockResolvedValue(makeStoredRecord());
    mockUpdate.mockResolvedValue(
      makeStoredRecord({
        name: "RSI Reversal Updated",
        description: "Updated description",
        tags: ["updated"],
        definition: {
          ...makeStoredRecord().definition,
          name: "RSI Reversal Updated",
          description: "Updated description",
        },
      }),
    );

    const result = await updateCustomStrategyDefinition("custom-1", {
      definition: {
        ...makeStoredRecord().definition,
        name: "RSI Reversal Updated",
        description: "Updated description",
      },
      tags: ["updated"],
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "custom-1" },
      data: {
        name: "RSI Reversal Updated",
        description: "Updated description",
        definitionVersion: 1,
        definition: {
          ...makeStoredRecord().definition,
          name: "RSI Reversal Updated",
          description: "Updated description",
        },
        tags: ["updated"],
      },
    });
    expect(result.tags).toEqual(["updated"]);
  });

  it("duplicates a stored custom definition with a copy suffix", async () => {
    mockFindUnique.mockResolvedValue(makeStoredRecord());
    mockCreate.mockResolvedValue(
      makeStoredRecord({
        id: "custom-2",
        name: "RSI Reversal (Copy)",
        definition: {
          ...makeStoredRecord().definition,
          name: "RSI Reversal (Copy)",
        },
      }),
    );

    const result = await duplicateCustomStrategyDefinition("custom-1");

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        name: "RSI Reversal (Copy)",
        description: "Buys RSI recovery above 30.",
        definitionVersion: 1,
        definition: {
          ...makeStoredRecord().definition,
          name: "RSI Reversal (Copy)",
        },
        tags: ["swing"],
      },
    });
    expect(result.definition.name).toBe("RSI Reversal (Copy)");
  });

  it("deletes a custom definition after ownership check", async () => {
    mockFindUnique.mockResolvedValue(makeStoredRecord());
    mockDelete.mockResolvedValue(undefined);

    await deleteCustomStrategyDefinition("custom-1");

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "custom-1" } });
  });

  it("throws when stored custom definitions fail runtime validation on read", async () => {
    mockFindMany.mockResolvedValue([
      makeStoredRecord({
        definition: {
          version: 1,
          name: "Broken",
          description: "",
          indicators: [],
          longEntry: {
            type: "group",
            operator: "AND",
            conditions: [
              {
                type: "condition",
                left: { kind: "indicator", indicatorId: "missing" },
                comparator: ">",
                right: { kind: "constant", value: 10 },
              },
            ],
          },
          longExit: { type: "group", operator: "AND", conditions: [] },
          shortEntry: { type: "group", operator: "AND", conditions: [] },
          shortExit: { type: "group", operator: "AND", conditions: [] },
        },
      }),
    ]);

    await expect(getCustomStrategyDefinitions()).rejects.toThrow(
      /Stored custom strategy definition 'custom-1' is invalid/,
    );
  });
});

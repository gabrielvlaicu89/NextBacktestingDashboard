import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireCurrentUser, mockCreateStrategy, mockCreateRun } = vi.hoisted(
  () => ({
    mockRequireCurrentUser: vi.fn(),
    mockCreateStrategy: vi.fn(),
    mockCreateRun: vi.fn(),
  }),
);

vi.mock("@/lib/current-user", () => ({
  requireCurrentUser: mockRequireCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    strategy: {
      create: mockCreateStrategy,
    },
    backtestRun: {
      create: mockCreateRun,
    },
  },
}));

import { createBacktestRun } from "@/lib/actions/backtest";

const customDefinition = {
  version: 1 as const,
  name: "RSI Draft",
  description: "Long-only custom draft.",
  indicators: [],
  longEntry: {
    type: "group" as const,
    operator: "AND" as const,
    conditions: [
      {
        type: "condition" as const,
        left: { kind: "price" as const, field: "CLOSE" as const },
        comparator: ">" as const,
        right: { kind: "constant" as const, value: 100 },
      },
    ],
  },
  longExit: {
    type: "group" as const,
    operator: "AND" as const,
    conditions: [
      {
        type: "condition" as const,
        left: { kind: "price" as const, field: "CLOSE" as const },
        comparator: "<" as const,
        right: { kind: "constant" as const, value: 99 },
      },
    ],
  },
  shortEntry: { type: "group" as const, operator: "AND" as const, conditions: [] },
  shortExit: { type: "group" as const, operator: "AND" as const, conditions: [] },
};

describe("createBacktestRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentUser.mockResolvedValue({ id: "user-1" });
    mockCreateStrategy.mockResolvedValue({ id: "strategy-1" });
    mockCreateRun.mockResolvedValue({ id: "run-1" });
  });

  it("persists a custom strategy snapshot when starting a custom backtest", async () => {
    const result = await createBacktestRun({
      name: "RSI Draft Run",
      tags: ["custom"],
      strategy_type: "CUSTOM",
      ticker: "SPY",
      date_from: "2024-01-01",
      date_to: "2024-12-31",
      benchmark: "SPY",
      risk_settings: {
        starting_capital: 10000,
        position_sizing_mode: "PERCENT_PORTFOLIO",
        position_size: 100,
        stop_loss_pct: null,
        take_profit_pct: null,
      },
      parameters: {
        custom_definition: customDefinition,
      },
    });

    expect(mockCreateStrategy).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        name: "RSI Draft Run",
        type: "CUSTOM",
        ticker: "SPY",
        parameters: {
          custom_definition: customDefinition,
        },
        tags: ["custom"],
      }),
    });
    expect(mockCreateRun).toHaveBeenCalledWith({
      data: {
        strategyId: "strategy-1",
        userId: "user-1",
        status: "PENDING",
      },
    });
    expect(result).toEqual({ strategyId: "strategy-1", runId: "run-1" });
  });
});
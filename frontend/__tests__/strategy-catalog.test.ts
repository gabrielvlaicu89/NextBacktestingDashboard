import { describe, it, expect } from "vitest";
import {
  STRATEGY_CATALOG,
  getCatalogItem,
  STRATEGY_LABELS,
} from "@/lib/strategy-catalog";

describe("strategy-catalog", () => {
  it("exports 5 strategies", () => {
    expect(STRATEGY_CATALOG).toHaveLength(5);
  });

  it("each catalog item has type, label, description, and params", () => {
    for (const item of STRATEGY_CATALOG) {
      expect(item).toHaveProperty("type");
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("params");
      expect(Array.isArray(item.params)).toBe(true);
    }
  });

  it("getCatalogItem returns correct item for MEAN_REVERSION", () => {
    const item = getCatalogItem("MEAN_REVERSION");
    expect(item).toBeDefined();
    expect(item!.label).toBe("Mean Reversion");
    expect(item!.params.length).toBeGreaterThan(0);
  });

  it("getCatalogItem returns correct item for BUY_AND_HOLD", () => {
    const item = getCatalogItem("BUY_AND_HOLD");
    expect(item).toBeDefined();
    expect(item!.params).toHaveLength(0);
  });

  it("getCatalogItem returns undefined for unknown type", () => {
    const item = getCatalogItem("UNKNOWN" as never);
    expect(item).toBeUndefined();
  });

  it("STRATEGY_LABELS has a label for every strategy type", () => {
    const types = STRATEGY_CATALOG.map((s) => s.type);
    for (const t of types) {
      expect(STRATEGY_LABELS[t]).toBeDefined();
      expect(typeof STRATEGY_LABELS[t]).toBe("string");
    }
  });

  it("Mean Reversion params include zscore_window, zscore_threshold, holding_period", () => {
    const item = getCatalogItem("MEAN_REVERSION")!;
    const keys = item.params.map((p) => p.key);
    expect(keys).toContain("zscore_window");
    expect(keys).toContain("zscore_threshold");
    expect(keys).toContain("holding_period");
  });

  it("MA Crossover params include ma_type with select options", () => {
    const item = getCatalogItem("MA_CROSSOVER")!;
    const maType = item.params.find((p) => p.key === "ma_type");
    expect(maType).toBeDefined();
    expect(maType!.type).toBe("select");
    expect(maType!.options).toContain("SMA");
    expect(maType!.options).toContain("EMA");
  });

  it("Pairs Trading params include ticker_b with type ticker", () => {
    const item = getCatalogItem("PAIRS_TRADING")!;
    const tickerB = item.params.find((p) => p.key === "ticker_b");
    expect(tickerB).toBeDefined();
    expect(tickerB!.type).toBe("ticker");
  });

  it("number params have min values set", () => {
    for (const item of STRATEGY_CATALOG) {
      for (const param of item.params) {
        if (param.type === "number") {
          expect(param.min).toBeDefined();
          expect(typeof param.min).toBe("number");
        }
      }
    }
  });
});

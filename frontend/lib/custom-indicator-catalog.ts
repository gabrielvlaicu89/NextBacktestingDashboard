import type {
  CustomIndicatorCatalogItem,
  IndicatorNode,
  IndicatorParamValue,
} from "@/lib/types";

export const CUSTOM_INDICATOR_CATALOG: CustomIndicatorCatalogItem[] = [
  {
    id: "RSI",
    label: "RSI",
    description: "Momentum oscillator that tracks recent up and down closes.",
    category: "Momentum",
    outputs: ["value"],
    params: [
      {
        key: "period",
        label: "Period",
        type: "number",
        default: 14,
        min: 2,
        max: 200,
        step: 1,
      },
    ],
  },
  {
    id: "SMA",
    label: "SMA",
    description: "Simple moving average over a fixed rolling window.",
    category: "Trend",
    outputs: ["value"],
    params: [
      {
        key: "period",
        label: "Period",
        type: "number",
        default: 20,
        min: 2,
        max: 250,
        step: 1,
      },
    ],
  },
  {
    id: "EMA",
    label: "EMA",
    description: "Exponential moving average with more weight on recent prices.",
    category: "Trend",
    outputs: ["value"],
    params: [
      {
        key: "period",
        label: "Period",
        type: "number",
        default: 20,
        min: 2,
        max: 250,
        step: 1,
      },
    ],
  },
  {
    id: "BOLLINGER_BANDS",
    label: "Bollinger Bands",
    description: "Rolling mean with upper and lower volatility bands.",
    category: "Volatility",
    outputs: ["upper", "middle", "lower"],
    params: [
      {
        key: "window",
        label: "Window",
        type: "number",
        default: 20,
        min: 2,
        max: 250,
        step: 1,
      },
      {
        key: "stdDev",
        label: "Std Dev",
        type: "number",
        default: 2,
        min: 0.5,
        max: 5,
        step: 0.25,
      },
    ],
  },
  {
    id: "MACD",
    label: "MACD",
    description: "Trend-following momentum indicator with a histogram output.",
    category: "Momentum",
    outputs: ["value", "histogram"],
    params: [
      {
        key: "fastPeriod",
        label: "Fast Period",
        type: "number",
        default: 12,
        min: 2,
        max: 100,
        step: 1,
      },
      {
        key: "slowPeriod",
        label: "Slow Period",
        type: "number",
        default: 26,
        min: 3,
        max: 200,
        step: 1,
      },
      {
        key: "signalPeriod",
        label: "Signal Period",
        type: "number",
        default: 9,
        min: 2,
        max: 100,
        step: 1,
      },
    ],
  },
];

export function getCustomIndicatorCatalogItem(
  indicatorId: string,
): CustomIndicatorCatalogItem | undefined {
  return CUSTOM_INDICATOR_CATALOG.find((indicator) => indicator.id === indicatorId);
}

function toIndicatorSlug(indicatorId: string): string {
  return indicatorId.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function createDefaultParams(
  catalogItem: CustomIndicatorCatalogItem,
): Record<string, IndicatorParamValue> {
  return Object.fromEntries(
    catalogItem.params.map((param) => [param.key, param.default]),
  );
}

function createDefaultLabel(
  catalogItem: CustomIndicatorCatalogItem,
  params: Record<string, IndicatorParamValue>,
  sequence: number,
): string {
  const primaryPeriod = params.period ?? params.window;

  if (typeof primaryPeriod === "number") {
    return `${catalogItem.label} ${primaryPeriod}`;
  }

  if (sequence > 1) {
    return `${catalogItem.label} ${sequence}`;
  }

  return catalogItem.label;
}

export function createCustomIndicatorNode(
  catalogItem: CustomIndicatorCatalogItem,
  existingIndicators: IndicatorNode[],
): IndicatorNode {
  const existingOfType = existingIndicators.filter(
    (indicator) => indicator.indicatorId === catalogItem.id,
  );
  const params = createDefaultParams(catalogItem);
  const slug = toIndicatorSlug(catalogItem.id);
  let sequence = existingOfType.length + 1;
  let id = `${slug}-${sequence}`;

  while (existingIndicators.some((indicator) => indicator.id === id)) {
    sequence += 1;
    id = `${slug}-${sequence}`;
  }

  return {
    id,
    indicatorId: catalogItem.id,
    label: createDefaultLabel(catalogItem, params, sequence),
    params,
  };
}
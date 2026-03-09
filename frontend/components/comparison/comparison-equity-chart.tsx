"use client";

/**
 * ComparisonEquityChart — overlays multiple equity curves on a single
 * Lightweight Charts instance, one colored line per strategy.
 *
 * All series are normalized to a base of 100 at the first data point so that
 * relative performance is comparable regardless of starting capital.
 */
import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  LineSeries,
  ColorType,
} from "lightweight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Palette ───────────────────────────────────────────────────────────────────

export const COMPARISON_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#dc2626", // red
  "#9333ea", // purple
  "#d97706", // amber
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EquitySeries {
  id: string;
  name: string;
  color?: string;
  data: Array<{ date: string; value: number }>;
}

interface ResolvedEquitySeries extends EquitySeries {
  color: string;
}

interface ComparisonEquityChartProps {
  series: EquitySeries[];
  height?: number;
}

function resolveSeriesStyle(series: EquitySeries[]): ResolvedEquitySeries[] {
  return series.map((entry, index) => ({
    ...entry,
    color: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ComparisonEquityChart({
  series,
  height = 380,
}: ComparisonEquityChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefsMap = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const resolvedSeries = resolveSeriesStyle(series);

  useEffect(() => {
    if (!containerRef.current || resolvedSeries.length === 0) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#888",
      },
      grid: {
        vertLines: { color: "rgba(128,128,128,0.1)" },
        horzLines: { color: "rgba(128,128,128,0.1)" },
      },
      rightPriceScale: { borderColor: "rgba(128,128,128,0.2)" },
      timeScale: { borderColor: "rgba(128,128,128,0.2)" },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    // Add one LineSeries per strategy
    for (const s of resolvedSeries) {
      if (s.data.length === 0) continue;

      const startValue = s.data[0].value || 1;
      const normalizedData = s.data.map((d) => ({
        time: d.date as string,
        value: Number(((d.value / startValue) * 100).toFixed(4)),
      }));

      const lineSeries = chart.addSeries(LineSeries, {
        color: s.color,
        lineWidth: 1,
        title: s.name,
      });
      lineSeries.setData(normalizedData);
      seriesRefsMap.current.set(s.id, lineSeries);
    }

    chart.timeScale().fitContent();

    // Responsive resize
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);

    const currentSeriesRefs = seriesRefsMap.current;
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      currentSeriesRefs.clear();
    };
  }, [resolvedSeries, height]);

  if (resolvedSeries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Equity Curve Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No equity data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equity Curve Comparison</CardTitle>
        <p className="text-sm text-muted-foreground">Normalized to 100 at start of period</p>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div
          data-testid="chart-legend"
          className="mb-4 flex flex-wrap gap-2"
        >
          {resolvedSeries.map((s) => (
            <div
              key={s.id}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5"
            >
              <span
                className="inline-block w-6"
                style={{
                  borderTopColor: s.color,
                  borderTopStyle: "solid",
                  borderTopWidth: "1px",
                }}
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-foreground">{s.name}</span>
            </div>
          ))}
        </div>

        <div
          data-testid="comparison-equity-chart"
          ref={containerRef}
          className="w-full"
        />
      </CardContent>
    </Card>
  );
}

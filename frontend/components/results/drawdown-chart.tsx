"use client";

/**
 * DrawdownChart — Lightweight Charts area series showing drawdown % over time.
 *
 * Rendered as a red-tinted area below zero.
 */
import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
} from "lightweight-charts";
import { AreaSeries } from "lightweight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DrawdownPoint {
  date: string;
  drawdown_pct: number;
}

interface DrawdownChartProps {
  data: DrawdownPoint[];
  height?: number;
}

export function DrawdownChart({ data, height = 250 }: DrawdownChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

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
      rightPriceScale: {
        borderColor: "rgba(128,128,128,0.2)",
      },
      timeScale: {
        borderColor: "rgba(128,128,128,0.2)",
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#ef4444",
      lineWidth: 1,
      topColor: "rgba(239, 68, 68, 0.4)",
      bottomColor: "rgba(239, 68, 68, 0.05)",
      title: "Drawdown %",
    });
    seriesRef.current = series;

    const chartData = data.map((d) => ({
      time: d.date as string,
      value: d.drawdown_pct,
    }));

    series.setData(chartData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Drawdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No drawdown data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="drawdown-chart">
      <CardHeader>
        <CardTitle>Drawdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} data-testid="drawdown-container" />
      </CardContent>
    </Card>
  );
}

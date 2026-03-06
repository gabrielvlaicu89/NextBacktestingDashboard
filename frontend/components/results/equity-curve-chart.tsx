"use client";

/**
 * EquityCurveChart — Lightweight Charts line series showing portfolio equity
 * over time with an optional benchmark overlay.
 *
 * Lightweight Charts requires a browser DOM, so this component must be "use client".
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

interface DataPoint {
  date: string;
  value: number;
  benchmark_value: number;
}

interface EquityCurveChartProps {
  data: DataPoint[];
  height?: number;
}

export function EquityCurveChart({
  data,
  height = 350,
}: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const portfolioSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const benchmarkSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

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
      crosshair: {
        mode: 0, // Normal
      },
    });
    chartRef.current = chart;

    // Portfolio line
    const portfolioSeries = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      title: "Portfolio",
    });
    portfolioSeriesRef.current = portfolioSeries;

    // Benchmark line
    const benchmarkSeries = chart.addSeries(LineSeries, {
      color: "#9ca3af",
      lineWidth: 1,
      lineStyle: 2, // Dashed
      title: "Benchmark",
    });
    benchmarkSeriesRef.current = benchmarkSeries;

    const portfolioData = data.map((d) => ({
      time: d.date as string,
      value: d.value,
    }));

    const benchmarkData = data.map((d) => ({
      time: d.date as string,
      value: d.benchmark_value,
    }));

    portfolioSeries.setData(portfolioData);
    benchmarkSeries.setData(benchmarkData);

    chart.timeScale().fitContent();

    // Handle responsive resize
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
          <CardTitle>Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No equity data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="equity-curve-chart">
      <CardHeader>
        <CardTitle>Equity Curve</CardTitle>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-blue-600" /> Portfolio
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-gray-400" style={{ borderTop: "1px dashed" }} /> Benchmark
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} data-testid="equity-curve-container" />
      </CardContent>
    </Card>
  );
}

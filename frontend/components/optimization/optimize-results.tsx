"use client";

/**
 * OptimizeResults — visualises the results of a grid-search optimisation run.
 *
 * Rendering rules:
 *   1 swept param  → Recharts LineChart (x = param value, y = metric)
 *   2 swept params → CSS heatmap grid (x = param0, y = param1, colour = metric)
 *   3+ swept params → sortable table (columns = params + metric)
 *
 * Clicking any result row / point calls onRunConfig(params) so the parent can
 * pre-fill the strategy builder with that parameter combination.
 */

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import type { OptimizeResultEntry } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface OptimizeResultsProps {
  results: OptimizeResultEntry[];
  optimizeFor: string;
  paramKeys: string[];
  onRunConfig: (params: Record<string, unknown>) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Normalise a metric value to [0, 1] for heatmap colouring. */
function normalise(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/** Blue → Green colour for the heatmap cells. */
function heatColour(intensity: number): string {
  const r = Math.round(30 + (1 - intensity) * 200);    // 30–230 (blue side)
  const g = Math.round(100 + intensity * 110);          // 100–210 (green side)
  const b = Math.round(200 - intensity * 170);          // 200–30
  return `rgb(${r},${g},${b})`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** 1-param: line chart */
function OneParamChart({
  results,
  paramKey,
  optimizeFor,
  onRunConfig,
}: {
  results: OptimizeResultEntry[];
  paramKey: string;
  optimizeFor: string;
  onRunConfig: (p: Record<string, unknown>) => void;
}) {
  const data = [...results]
    .filter((r) => r.metric !== null)
    .sort((a, b) => a.params[paramKey] - b.params[paramKey])
    .map((r) => ({ x: r.params[paramKey], y: r.metric as number, params: r.params }));

  return (
    <div data-testid="optimize-results-chart">
      <p className="mb-2 text-sm text-muted-foreground">
        Click a point to apply that parameter combination.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} onClick={(e) => {
          const pt = e?.activePayload?.[0]?.payload as { params: Record<string, unknown> } | undefined;
          if (pt?.params) onRunConfig(pt.params);
        }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="x" label={{ value: paramKey, position: "insideBottom", offset: -4 }} tick={{ fontSize: 11 }} />
          <YAxis label={{ value: optimizeFor, angle: -90, position: "insideLeft", offset: 10 }} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => v.toFixed(4)} />
          <Line type="monotone" dataKey="y" stroke="#2563eb" dot={{ r: 4, cursor: "pointer" }} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 2-params: CSS heatmap */
function TwoParamHeatmap({
  results,
  paramKeys,
  optimizeFor,
  onRunConfig,
}: {
  results: OptimizeResultEntry[];
  paramKeys: [string, string];
  optimizeFor: string;
  onRunConfig: (p: Record<string, unknown>) => void;
}) {
  const [xKey, yKey] = paramKeys;
  const validResults = results.filter((r) => r.metric !== null);

  const metrics = validResults.map((r) => r.metric as number);
  const minMetric = Math.min(...metrics);
  const maxMetric = Math.max(...metrics);

  const xVals = [...new Set(validResults.map((r) => r.params[xKey]))].sort((a, b) => a - b);
  const yVals = [...new Set(validResults.map((r) => r.params[yKey]))].sort((a, b) => a - b);

  const lookup = new Map(
    validResults.map((r) => [`${r.params[xKey]}_${r.params[yKey]}`, r]),
  );

  return (
    <div data-testid="optimize-results-heatmap" className="overflow-x-auto">
      <p className="mb-2 text-sm text-muted-foreground">
        Colour intensity = {optimizeFor}. Click a cell to apply those parameters.
      </p>
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="px-2 py-1 text-muted-foreground">{xKey} \ {yKey}</th>
            {yVals.map((y) => (
              <th key={y} className="px-2 py-1 font-mono">{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {xVals.map((x) => (
            <tr key={x}>
              <td className="px-2 py-1 font-mono font-semibold">{x}</td>
              {yVals.map((y) => {
                const entry = lookup.get(`${x}_${y}`);
                const val = entry?.metric ?? null;
                const intensity = val !== null ? normalise(val, minMetric, maxMetric) : 0;
                return (
                  <td
                    key={y}
                    onClick={() => entry && onRunConfig(entry.params)}
                    className="border px-2 py-1 text-center cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: val !== null ? heatColour(intensity) : "#e5e7eb", color: "#fff" }}
                    title={val !== null ? `${optimizeFor}: ${val.toFixed(4)}` : "No result"}
                  >
                    {val !== null ? val.toFixed(2) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 3+ params: sortable table */
function MultiParamTable({
  results,
  paramKeys,
  optimizeFor,
  onRunConfig,
}: {
  results: OptimizeResultEntry[];
  paramKeys: string[];
  optimizeFor: string;
  onRunConfig: (p: Record<string, unknown>) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("metric");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = sortKey === "metric" ? (a.metric ?? -Infinity) : (a.params[sortKey] ?? 0);
      const bv = sortKey === "metric" ? (b.metric ?? -Infinity) : (b.params[sortKey] ?? 0);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [results, sortKey, sortAsc]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div data-testid="optimize-results-table" className="overflow-x-auto rounded-lg border">
      <p className="px-4 py-2 text-sm text-muted-foreground">
        Click a row to apply that parameter combination.
      </p>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {paramKeys.map((k) => (
              <th key={k} className="px-4 py-2 text-left font-medium">
                <button
                  onClick={() => toggleSort(k)}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  {k}
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
            ))}
            <th className="px-4 py-2 text-left font-medium">
              <button
                onClick={() => toggleSort("metric")}
                className="flex items-center gap-1 hover:text-foreground"
              >
                {optimizeFor}
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => onRunConfig(row.params)}
            >
              {paramKeys.map((k) => (
                <td key={k} className="px-4 py-2 font-mono text-xs">
                  {row.params[k] ?? "—"}
                </td>
              ))}
              <td className="px-4 py-2 font-mono text-xs font-semibold">
                {row.metric !== null ? row.metric.toFixed(4) : "—"}
              </td>
              <td className="px-4 py-2">
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onRunConfig(row.params); }}>
                  Use
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OptimizeResults({
  results,
  optimizeFor,
  paramKeys,
  onRunConfig,
}: OptimizeResultsProps) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No results to display.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">
          Results ({results.length} combinations)
        </h3>
      </div>

      {paramKeys.length === 1 && (
        <OneParamChart
          results={results}
          paramKey={paramKeys[0]}
          optimizeFor={optimizeFor}
          onRunConfig={onRunConfig}
        />
      )}

      {paramKeys.length === 2 && (
        <TwoParamHeatmap
          results={results}
          paramKeys={paramKeys as [string, string]}
          optimizeFor={optimizeFor}
          onRunConfig={onRunConfig}
        />
      )}

      {paramKeys.length >= 3 && (
        <MultiParamTable
          results={results}
          paramKeys={paramKeys}
          optimizeFor={optimizeFor}
          onRunConfig={onRunConfig}
        />
      )}
    </div>
  );
}

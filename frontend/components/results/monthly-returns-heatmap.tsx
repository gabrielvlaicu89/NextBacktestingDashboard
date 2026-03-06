"use client";

/**
 * MonthlyReturnsHeatmap — custom grid showing month × year returns.
 *
 * Green gradient for positive returns, red gradient for negative,
 * tooltip with exact % on hover.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MonthlyReturn {
  year: number;
  month: number; // 1-12
  return_pct: number;
}

interface MonthlyReturnsHeatmapProps {
  data: MonthlyReturn[];
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Maps a return percentage to a Tailwind-compatible background color.
 * Uses inline styles for precise gradient control.
 */
function getCellColor(value: number): string {
  const absVal = Math.min(Math.abs(value), 20); // cap at 20% for color range
  const intensity = absVal / 20;

  if (value > 0) {
    // Green gradient
    const alpha = 0.15 + intensity * 0.6;
    return `rgba(34, 197, 94, ${alpha})`;
  } else if (value < 0) {
    // Red gradient
    const alpha = 0.15 + intensity * 0.6;
    return `rgba(239, 68, 68, ${alpha})`;
  }
  return "transparent";
}

export function MonthlyReturnsHeatmap({ data }: MonthlyReturnsHeatmapProps) {
  const { years, grid } = useMemo(() => {
    if (data.length === 0) return { years: [], grid: new Map() };

    const yearSet = new Set<number>();
    const grid = new Map<string, number>();

    for (const d of data) {
      yearSet.add(d.year);
      grid.set(`${d.year}-${d.month}`, d.return_pct);
    }

    const years = Array.from(yearSet).sort((a, b) => a - b);
    return { years, grid };
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Returns</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No monthly return data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="monthly-returns-heatmap">
      <CardHeader>
        <CardTitle>Monthly Returns</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-left text-muted-foreground">Year</th>
                  {MONTH_LABELS.map((label) => (
                    <th
                      key={label}
                      className="p-1 text-center text-muted-foreground"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years.map((year) => (
                  <tr key={year}>
                    <td className="p-1 font-medium text-muted-foreground">
                      {year}
                    </td>
                    {MONTH_LABELS.map((_, monthIdx) => {
                      const key = `${year}-${monthIdx + 1}`;
                      const value = grid.get(key);
                      const hasValue = value !== undefined;

                      return (
                        <td key={key} className="p-0.5">
                          {hasValue ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "flex h-8 w-full min-w-[2.5rem] items-center justify-center rounded text-xs font-medium",
                                    value! > 0
                                      ? "text-green-700 dark:text-green-300"
                                      : value! < 0
                                        ? "text-red-700 dark:text-red-300"
                                        : "text-muted-foreground"
                                  )}
                                  style={{
                                    backgroundColor: getCellColor(value!),
                                  }}
                                  data-testid={`heatmap-cell-${year}-${monthIdx + 1}`}
                                >
                                  {value!.toFixed(1)}%
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {MONTH_LABELS[monthIdx]} {year}:{" "}
                                  {value! >= 0 ? "+" : ""}
                                  {value!.toFixed(2)}%
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <div className="flex h-8 w-full min-w-[2.5rem] items-center justify-center rounded text-xs text-muted-foreground/30">
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

export { MONTH_LABELS, getCellColor };

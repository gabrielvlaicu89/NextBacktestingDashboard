"use client";

/**
 * WorkspaceGrid — client component that receives strategies from the server,
 * populates the Redux workspace slice, and renders sorted/filtered StrategyCards.
 */
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import { setStrategies } from "@/store/slices/workspaceSlice";
import { StrategyCard } from "@/components/workspace/strategy-card";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import type { StrategyWithRuns } from "@/lib/types";
import type { RootState } from "@/store/store";

interface WorkspaceGridProps {
  initialStrategies: StrategyWithRuns[];
}

export function WorkspaceGrid({ initialStrategies }: WorkspaceGridProps) {
  const dispatch = useDispatch();
  const { strategies, sortBy, sortDirection, filterType, filterTags } =
    useSelector((state: RootState) => state.workspace);

  // Hydrate the store with server-fetched strategies on mount
  useEffect(() => {
    dispatch(setStrategies(initialStrategies));
  }, [dispatch, initialStrategies]);

  // Apply filters + sorting client-side
  const displayStrategies = useMemo(() => {
    let result = [...strategies];

    // Filter by strategy type
    if (filterType) {
      result = result.filter((s) => s.type === filterType);
    }

    // Filter by tags (strategy must have ALL selected tags)
    if (filterTags.length > 0) {
      result = result.filter((s) =>
        filterTags.every((tag) => s.tags.includes(tag)),
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;

      if (sortBy === "createdAt") {
        cmp =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === "sharpe") {
        const aMetrics = a.runs.find((r) => r.status === "COMPLETED")?.results
          ?.metrics;
        const bMetrics = b.runs.find((r) => r.status === "COMPLETED")?.results
          ?.metrics;
        cmp = (aMetrics?.sharpe_ratio ?? -Infinity) - (bMetrics?.sharpe_ratio ?? -Infinity);
      } else if (sortBy === "return") {
        const aMetrics = a.runs.find((r) => r.status === "COMPLETED")?.results
          ?.metrics;
        const bMetrics = b.runs.find((r) => r.status === "COMPLETED")?.results
          ?.metrics;
        cmp =
          (aMetrics?.total_return_pct ?? -Infinity) -
          (bMetrics?.total_return_pct ?? -Infinity);
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [strategies, sortBy, sortDirection, filterType, filterTags]);

  return (
    <div className="space-y-6">
      <WorkspaceToolbar />

      {displayStrategies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <h3 className="text-lg font-medium">No strategies found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {strategies.length === 0
              ? "Create your first backtest to get started."
              : "No strategies match the current filters."}
          </p>
          {strategies.length === 0 && (
            <Link
              href="/dashboard/new"
              className="mt-4 text-sm font-medium text-primary hover:underline"
            >
              New Backtest →
            </Link>
          )}
        </div>
      ) : (
        <div
          data-testid="strategy-grid"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {displayStrategies.map((strategy) => (
            <StrategyCard key={strategy.id} strategy={strategy} />
          ))}
        </div>
      )}
    </div>
  );
}

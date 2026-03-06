"use client";

/**
 * WorkspaceToolbar — sort controls, filter controls, comparison button,
 * and "New Backtest" CTA for the workspace page.
 */
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  setSortBy,
  setSortDirection,
  setFilterType,
  type SortField,
  type SortDirection,
} from "@/store/slices/workspaceSlice";
import type { StrategyType } from "@/lib/types";
import type { RootState } from "@/store/store";

// ── Labels ────────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "createdAt", label: "Date Created" },
  { value: "sharpe", label: "Sharpe Ratio" },
  { value: "return", label: "Total Return" },
];

const DIRECTION_OPTIONS: { value: SortDirection; label: string }[] = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];

const STRATEGY_TYPE_OPTIONS: {
  value: StrategyType;
  label: string;
}[] = [
  { value: "MEAN_REVERSION", label: "Mean Reversion" },
  { value: "MA_CROSSOVER", label: "MA Crossover" },
  { value: "EARNINGS_DRIFT", label: "Earnings Drift" },
  { value: "PAIRS_TRADING", label: "Pairs Trading" },
  { value: "BUY_AND_HOLD", label: "Buy & Hold" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkspaceToolbar() {
  const dispatch = useDispatch();
  const router = useRouter();

  const sortBy = useSelector((state: RootState) => state.workspace.sortBy);
  const sortDirection = useSelector(
    (state: RootState) => state.workspace.sortDirection,
  );
  const filterType = useSelector(
    (state: RootState) => state.workspace.filterType,
  );
  const selectedIds = useSelector(
    (state: RootState) => state.comparison.selectedIds,
  );

  const handleSortChange = (value: string) => {
    dispatch(setSortBy(value as SortField));
  };

  const handleDirectionChange = (value: string) => {
    dispatch(setSortDirection(value as SortDirection));
  };

  const handleFilterChange = (value: string) => {
    dispatch(setFilterType(value === "ALL" ? null : (value as StrategyType)));
  };

  const handleCompare = () => {
    router.push(`/dashboard/compare?ids=${selectedIds.join(",")}`);
  };

  return (
    <div
      data-testid="workspace-toolbar"
      className="flex flex-wrap items-center gap-3"
    >
      {/* Sort by field */}
      <Select value={sortBy} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[160px]" aria-label="Sort by">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort direction */}
      <Select value={sortDirection} onValueChange={handleDirectionChange}>
        <SelectTrigger className="w-[140px]" aria-label="Sort direction">
          <SelectValue placeholder="Direction" />
        </SelectTrigger>
        <SelectContent>
          {DIRECTION_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filter by strategy type */}
      <Select
        value={filterType ?? "ALL"}
        onValueChange={handleFilterChange}
      >
        <SelectTrigger className="w-[170px]" aria-label="Filter by type">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Types</SelectItem>
          {STRATEGY_TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Compare Selected */}
      {selectedIds.length >= 2 && (
        <Button variant="outline" size="sm" onClick={handleCompare}>
          Compare Selected
          <Badge variant="secondary" className="ml-1.5">
            {selectedIds.length}
          </Badge>
        </Button>
      )}

      {/* New Backtest CTA */}
      <Button onClick={() => router.push("/dashboard/new")}>
        New Backtest
      </Button>
    </div>
  );
}

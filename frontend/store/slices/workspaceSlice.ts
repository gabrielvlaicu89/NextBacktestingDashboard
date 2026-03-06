/**
 * Workspace slice — holds the user's saved strategies list with filters and sorting.
 *
 * Populated by the strategies server action or API route when the dashboard loads.
 */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { StrategyType, StrategyWithRuns } from "@/lib/types";

export type SortField = "createdAt" | "sharpe" | "return";
export type SortDirection = "asc" | "desc";

export interface WorkspaceState {
  strategies: StrategyWithRuns[];
  loading: boolean;
  sortBy: SortField;
  sortDirection: SortDirection;
  filterType: StrategyType | null;
  filterTags: string[];
}

const initialState: WorkspaceState = {
  strategies: [],
  loading: false,
  sortBy: "createdAt",
  sortDirection: "desc",
  filterType: null,
  filterTags: [],
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setStrategies(state, action: PayloadAction<StrategyWithRuns[]>) {
      state.strategies = action.payload;
      state.loading = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setSortBy(state, action: PayloadAction<SortField>) {
      state.sortBy = action.payload;
    },
    setSortDirection(state, action: PayloadAction<SortDirection>) {
      state.sortDirection = action.payload;
    },
    setFilterType(state, action: PayloadAction<StrategyType | null>) {
      state.filterType = action.payload;
    },
    setFilterTags(state, action: PayloadAction<string[]>) {
      state.filterTags = action.payload;
    },
    removeStrategy(state, action: PayloadAction<string>) {
      state.strategies = state.strategies.filter((s) => s.id !== action.payload);
    },
  },
});

export const {
  setStrategies,
  setLoading,
  setSortBy,
  setSortDirection,
  setFilterType,
  setFilterTags,
  removeStrategy,
} = workspaceSlice.actions;

export const workspaceReducer = workspaceSlice.reducer;

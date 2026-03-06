import { configureStore } from "@reduxjs/toolkit";
import { strategyBuilderReducer } from "./slices/strategyBuilderSlice";
import { backtestReducer } from "./slices/backtestSlice";
import { comparisonReducer } from "./slices/comparisonSlice";
import { workspaceReducer } from "./slices/workspaceSlice";

export const store = configureStore({
  reducer: {
    strategyBuilder: strategyBuilderReducer,
    backtest: backtestReducer,
    comparison: comparisonReducer,
    workspace: workspaceReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

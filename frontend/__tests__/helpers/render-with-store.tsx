/**
 * Test utility — renders components within a Redux Provider for testing.
 */
import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { strategyBuilderReducer } from "@/store/slices/strategyBuilderSlice";
import { backtestReducer } from "@/store/slices/backtestSlice";
import { comparisonReducer } from "@/store/slices/comparisonSlice";
import { workspaceReducer } from "@/store/slices/workspaceSlice";
import type { RootState } from "@/store/store";

export function createTestStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: {
      strategyBuilder: strategyBuilderReducer,
      backtest: backtestReducer,
      comparison: comparisonReducer,
      workspace: workspaceReducer,
    },
    preloadedState: preloadedState as RootState,
  });
}

interface RenderWithStoreOptions extends Omit<RenderOptions, "wrapper"> {
  preloadedState?: Partial<RootState>;
  store?: ReturnType<typeof createTestStore>;
}

export function renderWithStore(
  ui: React.ReactElement,
  {
    preloadedState,
    store = createTestStore(preloadedState),
    ...renderOptions
  }: RenderWithStoreOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

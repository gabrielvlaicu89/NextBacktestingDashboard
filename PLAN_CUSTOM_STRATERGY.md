# Plan — Custom Strategy Builder

This document tracks the implementation plan for adding user-defined custom strategies built from predefined technical indicators, configurable parameters, and visual long/short rule definitions.

---

## Goals

- [ ] Allow users to create strategies beyond the current built-in set.
- [ ] Support a large predefined catalog of technical indicators.
- [ ] Let users configure indicator parameters from metadata-driven forms.
- [ ] Let users define advanced rule relationships between indicators and price data.
- [ ] Support separate long-entry, long-exit, short-entry, and short-exit logic.
- [ ] Add a dedicated `Build Custom Stratergy` page for all custom strategy authoring.
- [ ] Add a clear `Save` action on the custom strategy builder page.
- [ ] Turn `+ New Backtest` into a selection page with separate built-in and custom strategy sections.
- [ ] Keep the first custom-strategy release aligned with the platform's current daily-bar backtesting capabilities.
- [ ] Integrate custom strategies with backtesting, saving, duplication, comparison, optimization, and onboarding templates.
- [ ] Keep all existing built-in strategies working without regression.

---

## Product Scope

- [ ] Advanced visual rule builder.
- [ ] Long and short support from the first release.
- [ ] Dedicated custom strategy builder page under the dashboard navigation.
- [ ] Save custom strategy definitions without immediately running a backtest.
- [ ] `+ New Backtest` page shows two sections:
  - [ ] predefined strategies
  - [ ] saved custom strategies built on the dedicated page
- [ ] Daily-bar custom strategies using the same market-data capabilities as the current platform.
- [ ] Backtest builder and execution.
- [ ] Workspace persistence and duplicate flow.
- [ ] Optimization support.
- [ ] Comparison support.
- [ ] Onboarding templates for custom strategies.

---

## Architecture Decisions

- [ ] Implement custom strategies as a database-backed strategy-definition system.
- [ ] Do not allow arbitrary user-authored Python in the first release.
- [ ] Preserve built-in strategies as a stable first-class path.
- [ ] Separate custom strategy authoring from backtest launching in the UI.
- [ ] Treat the custom builder page as the source of truth for editing custom definitions.
- [ ] Treat the `+ New Backtest` page as a launcher that can start from either built-in presets or previously saved custom strategies.
- [ ] Keep the first implementation on the current daily OHLCV data model.
- [ ] Use a structured rule DSL / AST rather than free-text expressions.
- [ ] Use schema versioning for custom definitions.
- [ ] Consider schema versioning for backtest results if custom explainability payloads are added.
- [ ] Start with a curated indicator catalog instead of an unbounded indicator surface.

---

## UX / Navigation Requirements

- [ ] Add a new page under the dashboard navigation named `Build Custom Stratergy`.
- [ ] Define the route for the new page.
- [ ] Add navigation entry and active-state handling in the app shell.
- [ ] Keep all custom strategy creation and editing on that dedicated page.
- [ ] Add a primary `Save` button on the custom strategy builder page.
- [ ] Decide whether the custom builder page should also support `Save and Run` later, while keeping `Save` mandatory in the initial UX.
- [ ] Update the existing `+ New Backtest` page so it no longer contains custom-strategy authoring.
- [ ] Split the `+ New Backtest` page into two clear sections:
  - [ ] Pre-defined strategies
  - [ ] Custom strategies built on the dedicated page
- [ ] Decide how custom strategies are presented on `+ New Backtest`:
  - [ ] cards
  - [ ] searchable list
  - [ ] grouped by tags / last updated
- [ ] Define the launch flow from `+ New Backtest` for a saved custom strategy:
  - [ ] select saved custom strategy
  - [ ] review/edit backtest runtime config if needed
  - [ ] run backtest

---

## Phase 1 — Discovery Finalization & Domain Modeling

- [ ] Finalize the custom strategy domain model.
- [ ] Define what a custom strategy definition contains:
  - [ ] Indicator nodes
  - [ ] Indicator parameter values
  - [ ] Rule groups
  - [ ] Operands
  - [ ] Comparison operators
  - [ ] Boolean grouping (`AND` / `OR`)
  - [ ] Long-entry rules
  - [ ] Long-exit rules
  - [ ] Short-entry rules
  - [ ] Short-exit rules
- [ ] Define a versioned JSON schema for custom strategy definitions.
- [ ] Define a versioned TypeScript type model for custom strategy definitions.
- [ ] Define the daily-bar assumptions and constraints for custom strategies.
- [ ] Decide what explainability data should be stored with results:
  - [ ] Indicator series
  - [ ] Rule trigger traces
  - [ ] Signal traces
- [ ] Define compatibility rules between built-in strategies and custom strategies.

---

## Phase 2 — Persistence & Data Model Refactor

### Prisma Schema

- [x] Design and add a `CustomStrategyDefinition` model in [frontend/prisma/schema.prisma](./frontend/prisma/schema.prisma).
- [ ] Decide whether `Strategy` should reference a `StrategyDefinition` or embed a definition snapshot.
- [x] Add support for distinguishing built-in strategies from custom strategies.
- [x] Add schema version fields for custom definitions.
- [ ] Add optional result version fields for `BacktestRun` if custom result payloads are extended.
- [ ] Preserve backward compatibility for existing saved built-in strategies.

### Migration Work

- [x] Create Prisma migration(s) for custom strategy support.
- [ ] Ensure historical built-in strategies remain readable after migration.
- [ ] Decide whether existing `Strategy.type` remains enum-backed or moves to a string-based kind model.
- [ ] Backfill version fields where needed.

### Serialization Layer

- [x] Add dedicated custom definition CRUD actions in [frontend/lib/actions/custom-strategy-definitions.ts](./frontend/lib/actions/custom-strategy-definitions.ts).
- [x] Add runtime validation on read, not just on write.
- [ ] Refactor [frontend/lib/actions/strategies.ts](./frontend/lib/actions/strategies.ts) to serialize/deserialize custom definitions safely.
- [ ] Remove unsafe `as` casts where custom strategy definitions or versioned results are involved.

---

## Phase 3 — Shared Type System & Validation Refactor

### Frontend Types

- [x] Extend [frontend/lib/types.ts](./frontend/lib/types.ts) with:
  - [x] Custom strategy definition types
  - [x] Indicator metadata types
  - [x] Rule group types
  - [x] Operand types
  - [x] Comparison operator types
  - [x] Builder mode types
  - [ ] Custom optimization parameter exposure types
- [ ] Refactor hardcoded `StrategyType` assumptions where required.

### Frontend Validation

- [x] Refactor [frontend/lib/validations.ts](./frontend/lib/validations.ts) to support custom strategy payloads.
- [ ] Replace fixed `z.enum(STRATEGY_TYPES)` assumptions where needed.
- [x] Add zod schemas for:
  - [x] Indicator config
  - [x] Rule node
  - [x] Rule group
  - [x] Custom strategy definition
  - [x] Custom definition create/update payloads
  - [ ] Custom optimize request

### Backend Validation

- [ ] Extend [backend/app/models/schemas.py](./backend/app/models/schemas.py) with Pydantic models for custom strategy definitions.
- [ ] Add validation for indicator configs and rule structures.
- [ ] Add version-aware parsing for custom definitions.

---

## Phase 4 — Backend Indicator Registry

- [ ] Create a reusable indicator library module in the backend.
- [ ] Extract duplicated indicator logic from built-in strategies into shared utilities.
- [ ] Implement a registry entry shape for indicators:
  - [ ] id
  - [ ] label
  - [ ] category
  - [ ] parameter schema
  - [ ] required inputs
  - [ ] output shape
  - [ ] compute function
- [ ] Add a curated initial set of indicators.

### Initial Indicator Catalog Candidate Set

- [ ] SMA
- [ ] EMA
- [ ] WMA
- [ ] RSI
- [ ] MACD
- [ ] Bollinger Bands
- [ ] ATR
- [ ] Stochastic Oscillator
- [ ] ADX
- [ ] CCI
- [ ] ROC
- [ ] Momentum
- [ ] OBV
- [ ] VWAP
- [ ] Donchian Channels
- [ ] Rolling Mean
- [ ] Rolling StdDev
- [ ] Z-Score
- [ ] Highest High
- [ ] Lowest Low

### Backend Catalog Endpoints

- [ ] Add backend endpoint(s) to expose indicator metadata.
- [ ] Add backend endpoint(s) to expose built-in strategy metadata and custom-builder metadata separately if helpful.
- [ ] Replace or extend [backend/app/routers/strategies.py](./backend/app/routers/strategies.py) so the frontend no longer depends on only a hardcoded static strategy list.

---

## Phase 5 — Backend Custom Rule Engine

- [ ] Design a custom rule evaluator format.
- [ ] Support operands for:
  - [ ] Price fields (`Open`, `High`, `Low`, `Close`, `Volume`)
  - [ ] Indicator outputs
  - [ ] Numeric constants
- [ ] Support comparison operators:
  - [ ] `>`
  - [ ] `>=`
  - [ ] `<`
  - [ ] `<=`
  - [ ] `==`
  - [ ] `crosses_above`
  - [ ] `crosses_below`
- [ ] Support grouped boolean logic:
  - [ ] `AND`
  - [ ] `OR`
  - [ ] nested groups
- [ ] Build a compiler/evaluator that turns stored definitions into signal series.
- [ ] Produce explicit signal outputs for:
  - [ ] long entry
  - [ ] long exit
  - [ ] short entry
  - [ ] short exit
- [ ] Validate references so rules cannot target missing indicators or invalid fields.
- [ ] Prevent circular indicator dependencies if chained indicators are supported.

---

## Phase 6 — Backend Execution Engine Refactor

- [ ] Refactor [backend/app/engine/base.py](./backend/app/engine/base.py) to support long and short positions.
- [ ] Preserve existing built-in strategy behavior.
- [ ] Decide whether built-ins keep returning simple `signal` columns or move to a richer signal interface.
- [ ] Add support for:
  - [ ] long position lifecycle
  - [ ] short position lifecycle
  - [ ] stop-loss for long positions
  - [ ] stop-loss for short positions
  - [ ] take-profit for long positions
  - [ ] take-profit for short positions
  - [ ] explicit exit reasons per side
- [ ] Ensure PnL, equity curve, and trade logs remain correct under shorting.
- [ ] Add compatibility adapters so built-in strategies can continue to run while custom strategies use the richer signal model.

---

## Phase 7 — Backend Strategy Resolution & Backtest Flow

- [ ] Replace hardcoded strategy resolution in [backend/app/engine/base.py](./backend/app/engine/base.py) with a registry/factory layer.
- [ ] Allow the backtest flow to resolve either:
  - [ ] built-in strategy class
  - [ ] custom strategy definition
- [ ] Refactor [backend/app/routers/backtest.py](./backend/app/routers/backtest.py) so strategy-specific branching is not hardcoded by enum where avoidable.
- [ ] Add dependency resolution for custom indicators and data inputs.
- [ ] Ensure SSE responses continue to work with custom strategy runs.
- [ ] Ensure result payloads stay valid JSON.

---

## Phase 8 — Backend Optimization Support

- [ ] Refactor [backend/app/services/optimizer.py](./backend/app/services/optimizer.py) to support custom strategies.
- [ ] Define how optimizable fields are exposed from custom definitions.
- [ ] Support optimization of:
  - [ ] numeric indicator parameters
  - [ ] numeric rule thresholds
- [ ] Prevent optimization of incompatible or derived fields.
- [ ] Ensure optimization metadata can be rendered clearly in the frontend.

---

## Phase 9 — Frontend Builder State Refactor

- [x] Refactor [frontend/store/slices/strategyBuilderSlice.ts](./frontend/store/slices/strategyBuilderSlice.ts) to support both built-in and custom builder modes.
- [x] Add a discriminated builder state shape.
- [x] Preserve existing built-in strategy drafting behavior.
- [x] Separate state used for the dedicated custom builder page from state used to launch a backtest from `+ New Backtest`.
- [x] Add custom draft sub-state for:
  - [x] selected indicators
  - [x] indicator params
  - [x] rule groups
  - [x] long-entry rules
  - [x] long-exit rules
  - [x] short-entry rules
  - [x] short-exit rules
  - [ ] validation errors
  - [ ] optimization exposure metadata
- [x] Ensure duplicate/prefill flows work for both built-in and custom strategies.
- [x] Ensure reset behavior works cleanly for custom drafts.

---

## Phase 10 — Frontend Custom Builder UX

### Entry Point & Mode Selection

- [x] Add a dedicated page for custom strategy authoring, likely under `app/dashboard/build-custom-stratergy/page.tsx`.
- [ ] Add any supporting loading/error states for the custom builder page.
- [x] Add a `Save` button to persist custom strategy definitions from the dedicated builder page.
- [x] Add support for editing an existing saved custom strategy from the dedicated builder page.
- [x] Decide whether the page should support query-param or route-param based editing for saved custom strategies.

### Indicator Selection UI

- [ ] Build a searchable indicator library picker.
- [x] Group indicators by category.
- [x] Let users add/remove multiple indicators.
- [x] Show parameter editors based on indicator metadata.

### Rule Builder UI

- [ ] Build visual editors for:
  - [ ] long-entry rules
  - [ ] long-exit rules
  - [ ] short-entry rules
  - [ ] short-exit rules
- [ ] Allow nested groups.
- [ ] Allow indicator-to-indicator comparisons.
- [ ] Allow indicator-to-price comparisons.
- [ ] Allow indicator-to-constant comparisons.
- [ ] Support advanced conditions like crossings.
- [ ] Prevent invalid incomplete rules from being saved or run.

### Builder Integration

- [x] Refactor [frontend/components/strategy-builder/strategy-builder-form.tsx](./frontend/components/strategy-builder/strategy-builder-form.tsx) so it remains focused on built-in strategies and backtest launching.
- [x] Add a separate custom strategy builder container/component for the new dedicated page.
- [ ] Decide whether [frontend/components/strategy-builder/strategy-params-form.tsx](./frontend/components/strategy-builder/strategy-params-form.tsx) remains built-in-only.
- [ ] Add inline validation and summary errors for custom rule definitions.

### `+ New Backtest` Page UX

- [x] Redesign the `+ New Backtest` page into a launcher with two sections.
- [x] Section 1: pre-defined strategies.
- [x] Section 2: saved custom strategies from the dedicated builder page.
- [x] Add fetch/load logic so the page can list saved custom strategies.
- [ ] Define how a user selects a custom strategy and starts a backtest from the launcher page.
- [ ] Decide whether selecting a custom strategy should:
  - [ ] immediately run using saved settings
  - [ ] prefill a run configuration form
  - [ ] navigate to a review page before execution

---

## Phase 11 — Frontend Catalog & Metadata Loading

- [ ] Replace frontend reliance on static built-in strategy metadata.
- [ ] Fetch strategy and indicator metadata from the backend.
- [ ] Decide where to cache catalog data:
  - [ ] Redux
  - [ ] React Query
  - [ ] server-loaded props
  - [ ] other shared client cache
- [ ] Keep the builder responsive while metadata loads.
- [ ] Provide robust fallback/error handling if catalog fetch fails.

---

## Phase 12 — Save, Duplicate, Workspace, and Onboarding Integration

### Save & CRUD

- [ ] Extend [frontend/lib/actions/backtest.ts](./frontend/lib/actions/backtest.ts) to create strategy instances tied to custom definitions.
- [x] Extend [frontend/lib/actions/strategies.ts](./frontend/lib/actions/strategies.ts) to save, fetch, update, and duplicate custom definitions.
- [ ] Ensure strategy serialization remains stable.
- [x] Add dedicated save/update flows for custom strategy definitions independent of backtest execution.
- [x] Ensure the custom builder page `Save` button persists the definition without requiring a run.

### Workspace

- [ ] Update workspace rendering to show custom strategy labels and metadata clearly.
- [ ] Update [frontend/components/workspace/strategy-card.tsx](./frontend/components/workspace/strategy-card.tsx) for custom strategy identity and duplicate behavior.
- [ ] Ensure filtering and sorting still work for custom strategies.
- [ ] Decide whether saved custom strategies appear only on the `+ New Backtest` launcher page or also in the main workspace before they have any runs.

### Onboarding

- [ ] Add starter custom strategy templates to [frontend/components/strategy-builder/onboarding-modal.tsx](./frontend/components/strategy-builder/onboarding-modal.tsx).
- [ ] Ensure templates serialize using the same custom-definition schema as user-created strategies.

---

## Phase 13 — Results, Comparison, and Explainability

- [ ] Ensure custom strategies render in the results dashboard without breaking the existing UI.
- [ ] Decide whether custom results include optional explainability panels.
- [ ] If implemented, add UI for:
  - [ ] indicator values
  - [ ] rule triggers
  - [ ] signal markers
- [ ] Ensure comparison flows accept custom strategies exactly like built-ins.
- [ ] Ensure the compare page can label custom strategies meaningfully.

---

## Phase 14 — Optimization UX for Custom Strategies

- [ ] Extend [frontend/components/optimization/optimize-config-form.tsx](./frontend/components/optimization/optimize-config-form.tsx) to read optimizable fields from custom strategy metadata.
- [ ] Show numeric indicator params and rule thresholds that can be swept.
- [ ] Prevent invalid parameter sweep combinations.
- [ ] Ensure optimization results remain navigable back to saved runs.

---

## Phase 15 — Compatibility, Migration, and Hardening

- [ ] Add schema version checks for custom definitions.
- [ ] Add safe deserialization on read paths.
- [ ] Ensure old built-in strategies remain editable/runnable.
- [ ] Ensure old result payloads remain readable.
- [ ] Decide whether built-in strategies should eventually be representable as the same custom-definition format.
- [ ] Add protection against malformed or corrupted custom definitions.

---

## Testing & Verification

### Backend Unit Tests

- [ ] Indicator registry tests.
- [ ] Indicator computation tests.
- [ ] Rule evaluation tests.
- [ ] Nested boolean group tests.
- [ ] Cross-over operator tests.
- [ ] Long/short execution tests.
- [ ] Stop-loss/take-profit tests for both sides.
- [ ] Custom strategy optimization parameter extraction tests.

### Backend Integration Tests

- [ ] `/api/backtest/run` with valid custom definition.
- [ ] `/api/backtest/run` with invalid custom definition.
- [ ] `/api/backtest/run` with missing indicator reference.
- [ ] `/api/backtest/optimize` for custom strategies.
- [ ] SSE payload validation for custom strategies.

### Frontend Tests

- [x] Builder slice tests for custom drafts.
- [x] Custom definition action tests.
- [x] Custom definition create/update validation tests.
- [x] Custom builder workspace tests.
- [x] Saved custom strategies launcher tests.
- [x] Sidebar navigation tests for the dedicated custom builder page.
- [x] Indicator picker component tests.
- [x] Indicator parameter form tests.
- [ ] Rule builder interaction tests.
- [x] Duplicate flow tests.
- [ ] Workspace rendering tests for custom strategies.
- [ ] Optimization form tests for custom strategy metadata.
- [ ] Comparison compatibility tests.

### Manual Smoke Tests

- [x] Create a custom strategy from scratch.
- [x] Save it successfully.
- [x] Reopen it successfully.
- [ ] Duplicate it successfully.
- [ ] Run a backtest successfully.
- [ ] Compare it with built-in strategies.
- [ ] Optimize at least one indicator/rule threshold.
- [ ] Confirm mobile behavior remains acceptable.

---

## Key Files To Update

- [x] [frontend/prisma/schema.prisma](./frontend/prisma/schema.prisma)
- [x] [frontend/prisma/migrations/20260309150000_add_custom_strategy_definitions/migration.sql](./frontend/prisma/migrations/20260309150000_add_custom_strategy_definitions/migration.sql)
- [x] [frontend/lib/types.ts](./frontend/lib/types.ts)
- [x] [frontend/lib/custom-indicator-catalog.ts](./frontend/lib/custom-indicator-catalog.ts)
- [x] [frontend/lib/validations.ts](./frontend/lib/validations.ts)
- [x] [frontend/lib/actions/custom-strategy-definitions.ts](./frontend/lib/actions/custom-strategy-definitions.ts)
- [x] [frontend/store/slices/strategyBuilderSlice.ts](./frontend/store/slices/strategyBuilderSlice.ts)
- [x] [frontend/app/dashboard/new/page.tsx](./frontend/app/dashboard/new/page.tsx)
- [x] [frontend/app/dashboard/build-custom-stratergy/page.tsx](./frontend/app/dashboard/build-custom-stratergy/page.tsx)
- [ ] [frontend/components/strategy-builder/strategy-builder-form.tsx](./frontend/components/strategy-builder/strategy-builder-form.tsx)
- [ ] [frontend/components/strategy-builder/strategy-type-selector.tsx](./frontend/components/strategy-builder/strategy-type-selector.tsx)
- [ ] [frontend/components/strategy-builder/strategy-params-form.tsx](./frontend/components/strategy-builder/strategy-params-form.tsx)
- [ ] [frontend/components/strategy-builder/onboarding-modal.tsx](./frontend/components/strategy-builder/onboarding-modal.tsx)
- [x] [frontend/components/custom-strategy/custom-strategy-builder-workspace.tsx](./frontend/components/custom-strategy/custom-strategy-builder-workspace.tsx)
- [x] [frontend/components/custom-strategy/custom-strategy-indicator-library.tsx](./frontend/components/custom-strategy/custom-strategy-indicator-library.tsx)
- [x] [frontend/components/custom-strategy/saved-custom-strategies-section.tsx](./frontend/components/custom-strategy/saved-custom-strategies-section.tsx)
- [x] [frontend/components/layout/app-sidebar.tsx](./frontend/components/layout/app-sidebar.tsx)
- [ ] [frontend/components/layout/mobile-header.tsx](./frontend/components/layout/mobile-header.tsx)
- [ ] [frontend/components/optimization/optimize-config-form.tsx](./frontend/components/optimization/optimize-config-form.tsx)
- [ ] [frontend/components/workspace/strategy-card.tsx](./frontend/components/workspace/strategy-card.tsx)
- [ ] [frontend/lib/actions/backtest.ts](./frontend/lib/actions/backtest.ts)
- [ ] [frontend/lib/actions/strategies.ts](./frontend/lib/actions/strategies.ts)
- [ ] [frontend/app/api/backtest/route.ts](./frontend/app/api/backtest/route.ts)
- [ ] [backend/app/models/schemas.py](./backend/app/models/schemas.py)
- [ ] [backend/app/engine/base.py](./backend/app/engine/base.py)
- [ ] [backend/app/engine/mean_reversion.py](./backend/app/engine/mean_reversion.py)
- [ ] [backend/app/engine/ma_crossover.py](./backend/app/engine/ma_crossover.py)
- [ ] [backend/app/engine/pairs_trading.py](./backend/app/engine/pairs_trading.py)
- [ ] [backend/app/routers/backtest.py](./backend/app/routers/backtest.py)
- [ ] [backend/app/routers/strategies.py](./backend/app/routers/strategies.py)
- [ ] [backend/app/services/optimizer.py](./backend/app/services/optimizer.py)
- [ ] [backend/app/services/metrics.py](./backend/app/services/metrics.py)
- [ ] [backend/tests/](./backend/tests/)

---

## Open Questions

- [ ] Should custom strategies and built-in strategies share one unified catalog response or separate endpoints?
- [ ] Should the `Build Custom Stratergy` page support both create and edit modes from day one?
- [ ] Should the `+ New Backtest` page allow lightweight editing of a saved custom strategy before running, or only selection?
- [ ] Should saved custom strategies appear in the main workspace even before they have any runs?
- [ ] Should saved custom strategies snapshot the full definition at run time for reproducibility?
- [ ] Should explainability data be stored by default or only when requested?
- [ ] Should indicator chaining be supported in the first release?
- [ ] Should custom strategies eventually replace the need for some built-in strategies?

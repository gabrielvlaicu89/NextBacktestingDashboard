/**
 * Tests for WorkspaceToolbar component.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { renderWithStore } from "../helpers/render-with-store";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WorkspaceToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sort, direction, and filter selects", () => {
    renderWithStore(<WorkspaceToolbar />);
    expect(screen.getByLabelText("Sort by")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort direction")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by type")).toBeInTheDocument();
  });

  it("renders the New Backtest button", () => {
    renderWithStore(<WorkspaceToolbar />);
    expect(screen.getByText("New Backtest")).toBeInTheDocument();
  });

  it("navigates to /dashboard/new on New Backtest click", async () => {
    renderWithStore(<WorkspaceToolbar />);
    await userEvent.click(screen.getByText("New Backtest"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/new");
  });

  it("does NOT show Compare Selected when fewer than 2 are selected", () => {
    renderWithStore(<WorkspaceToolbar />, {
      preloadedState: {
        comparison: { selectedIds: ["strat-1"], results: {} },
      },
    });
    expect(screen.queryByText("Compare Selected")).not.toBeInTheDocument();
  });

  it("shows Compare Selected when 2+ strategies are selected", () => {
    renderWithStore(<WorkspaceToolbar />, {
      preloadedState: {
        comparison: { selectedIds: ["strat-1", "strat-2"], results: {} },
      },
    });
    expect(screen.getByText("Compare Selected")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("navigates to compare page with IDs on Compare Selected click", async () => {
    renderWithStore(<WorkspaceToolbar />, {
      preloadedState: {
        comparison: { selectedIds: ["strat-1", "strat-2"], results: {} },
      },
    });
    await userEvent.click(screen.getByText("Compare Selected"));
    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/compare?ids=strat-1,strat-2",
    );
  });

  it("reflects sortBy from Redux state", () => {
    renderWithStore(<WorkspaceToolbar />, {
      preloadedState: {
        workspace: {
          strategies: [],
          loading: false,
          sortBy: "sharpe",
          sortDirection: "desc",
          filterType: null,
          filterTags: [],
        },
      },
    });
    // The trigger should display the current sort label
    expect(screen.getByLabelText("Sort by")).toHaveTextContent(
      "Sharpe Ratio",
    );
  });

  it("reflects sortDirection from Redux state", () => {
    renderWithStore(<WorkspaceToolbar />, {
      preloadedState: {
        workspace: {
          strategies: [],
          loading: false,
          sortBy: "createdAt",
          sortDirection: "asc",
          filterType: null,
          filterTags: [],
        },
      },
    });
    expect(screen.getByLabelText("Sort direction")).toHaveTextContent(
      "Ascending",
    );
  });

  it("reflects filterType from Redux state", () => {
    renderWithStore(<WorkspaceToolbar />, {
      preloadedState: {
        workspace: {
          strategies: [],
          loading: false,
          sortBy: "createdAt",
          sortDirection: "desc",
          filterType: "MA_CROSSOVER",
          filterTags: [],
        },
      },
    });
    expect(screen.getByLabelText("Filter by type")).toHaveTextContent(
      "MA Crossover",
    );
  });

  it("shows All Types when filterType is null", () => {
    renderWithStore(<WorkspaceToolbar />);
    expect(screen.getByLabelText("Filter by type")).toHaveTextContent(
      "All Types",
    );
  });

  it("displays 3 selected count in Compare badge", () => {
    renderWithStore(<WorkspaceToolbar />, {
      preloadedState: {
        comparison: {
          selectedIds: ["strat-1", "strat-2", "strat-3"],
          results: {},
        },
      },
    });
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

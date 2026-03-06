/**
 * Tests for SaveExperimentDialog component.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveExperimentDialog } from "@/components/results/save-experiment-dialog";

// Mock the server action
vi.mock("@/lib/actions/strategies", () => ({
  updateStrategy: vi.fn(),
}));

import { updateStrategy } from "@/lib/actions/strategies";
const mockUpdateStrategy = vi.mocked(updateStrategy);

const defaultProps = {
  strategyId: "strat-1",
  currentName: "My Strategy",
  currentTags: ["momentum", "daily"],
};

describe("SaveExperimentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateStrategy.mockResolvedValue(undefined as never);
  });

  it("renders the trigger button", () => {
    render(<SaveExperimentDialog {...defaultProps} />);
    expect(screen.getByTestId("save-experiment-trigger")).toBeInTheDocument();
    expect(screen.getByText("Save as Experiment")).toBeInTheDocument();
  });

  it("opens dialog on trigger click", async () => {
    render(<SaveExperimentDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));
    expect(screen.getByTestId("save-experiment-dialog")).toBeInTheDocument();
  });

  it("pre-fills name with currentName", async () => {
    render(<SaveExperimentDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));
    const input = screen.getByTestId("experiment-name-input") as HTMLInputElement;
    expect(input.value).toBe("My Strategy");
  });

  it("pre-fills tags with currentTags", async () => {
    render(<SaveExperimentDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));
    expect(screen.getByTestId("tag-momentum")).toBeInTheDocument();
    expect(screen.getByTestId("tag-daily")).toBeInTheDocument();
  });

  it("adds a new tag via Add button", async () => {
    render(<SaveExperimentDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));

    const tagInput = screen.getByTestId("experiment-tag-input");
    await userEvent.type(tagInput, "weekly");
    await userEvent.click(screen.getByTestId("add-tag-button"));

    expect(screen.getByTestId("tag-weekly")).toBeInTheDocument();
  });

  it("adds a new tag via Enter key", async () => {
    render(<SaveExperimentDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));

    const tagInput = screen.getByTestId("experiment-tag-input");
    await userEvent.type(tagInput, "intraday{Enter}");

    expect(screen.getByTestId("tag-intraday")).toBeInTheDocument();
  });

  it("removes a tag when X is clicked", async () => {
    render(<SaveExperimentDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));

    // Click the remove button inside the "momentum" badge
    const removeBtn = screen.getByRole("button", { name: /Remove momentum/i });
    await userEvent.click(removeBtn);

    expect(screen.queryByTestId("tag-momentum")).not.toBeInTheDocument();
    // Other tags remain
    expect(screen.getByTestId("tag-daily")).toBeInTheDocument();
  });

  it("does not add duplicate tags", async () => {
    render(<SaveExperimentDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));

    const tagInput = screen.getByTestId("experiment-tag-input");
    await userEvent.type(tagInput, "momentum{Enter}");

    // Should still have only one "momentum" badge
    const badges = screen.getAllByTestId("tag-momentum");
    expect(badges).toHaveLength(1);
  });

  it("calls updateStrategy with correct args on save", async () => {
    const onSaved = vi.fn();
    render(<SaveExperimentDialog {...defaultProps} onSaved={onSaved} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));

    await userEvent.click(screen.getByTestId("save-experiment-button"));

    await waitFor(() => {
      expect(mockUpdateStrategy).toHaveBeenCalledWith("strat-1", {
        name: "My Strategy",
        tags: ["momentum", "daily"],
      });
    });
    expect(onSaved).toHaveBeenCalledWith("My Strategy", ["momentum", "daily"]);
  });

  it("shows error when name is empty", async () => {
    render(<SaveExperimentDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));

    // Clear the name field
    const nameInput = screen.getByTestId("experiment-name-input");
    await userEvent.clear(nameInput);

    await userEvent.click(screen.getByTestId("save-experiment-button"));

    expect(screen.getByTestId("save-error")).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(mockUpdateStrategy).not.toHaveBeenCalled();
  });

  it("shows error when server action fails", async () => {
    mockUpdateStrategy.mockRejectedValueOnce(new Error("Network error"));
    render(<SaveExperimentDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));

    await userEvent.click(screen.getByTestId("save-experiment-button"));

    await waitFor(() => {
      expect(screen.getByTestId("save-error")).toBeInTheDocument();
    });
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("disables Add button when tag input is empty", async () => {
    render(<SaveExperimentDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("save-experiment-trigger"));

    const addBtn = screen.getByTestId("add-tag-button");
    expect(addBtn).toBeDisabled();
  });
});

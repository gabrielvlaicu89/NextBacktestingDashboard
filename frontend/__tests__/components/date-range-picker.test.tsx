import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DateRangePicker } from "@/components/strategy-builder/date-range-picker";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DateRangePicker", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Start Date and End Date labels", () => {
    render(<DateRangePicker dateFrom="" dateTo="" onChange={onChange} />);
    expect(screen.getByText("Start Date")).toBeInTheDocument();
    expect(screen.getByText("End Date")).toBeInTheDocument();
  });

  it("shows placeholder text when no dates selected", () => {
    render(<DateRangePicker dateFrom="" dateTo="" onChange={onChange} />);
    const fromTrigger = screen.getByTestId("date-from-trigger");
    const toTrigger = screen.getByTestId("date-to-trigger");
    expect(fromTrigger).toHaveTextContent("Pick a date");
    expect(toTrigger).toHaveTextContent("Pick a date");
  });

  it("displays provided date values", () => {
    render(
      <DateRangePicker
        dateFrom="2023-01-15"
        dateTo="2024-06-30"
        onChange={onChange}
      />
    );
    expect(screen.getByTestId("date-from-trigger")).toHaveTextContent(
      "2023-01-15"
    );
    expect(screen.getByTestId("date-to-trigger")).toHaveTextContent(
      "2024-06-30"
    );
  });

  it("disables both triggers when disabled=true", () => {
    render(
      <DateRangePicker dateFrom="" dateTo="" onChange={onChange} disabled />
    );
    expect(screen.getByTestId("date-from-trigger")).toBeDisabled();
    expect(screen.getByTestId("date-to-trigger")).toBeDisabled();
  });

  it("opens calendar popover when from trigger is clicked", async () => {
    render(<DateRangePicker dateFrom="" dateTo="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("date-from-trigger"));
    await waitFor(() => {
      // react-day-picker renders a table with role="grid"
      expect(document.querySelector("table")).toBeInTheDocument();
    });
  });

  it("opens calendar popover when to trigger is clicked", async () => {
    render(<DateRangePicker dateFrom="" dateTo="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("date-to-trigger"));
    await waitFor(() => {
      expect(document.querySelector("table")).toBeInTheDocument();
    });
  });

  it("renders two trigger buttons", () => {
    render(<DateRangePicker dateFrom="" dateTo="" onChange={onChange} />);
    const triggers = screen.getAllByRole("button");
    expect(triggers.length).toBeGreaterThanOrEqual(2);
  });
});

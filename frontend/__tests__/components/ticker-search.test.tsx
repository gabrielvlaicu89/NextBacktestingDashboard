import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TickerSearch } from "@/components/strategy-builder/ticker-search";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetQuery = vi.fn();
const mockResults = vi.fn<[], { symbol: string; name: string }[]>(() => []);
const mockLoading = vi.fn(() => false);

vi.mock("@/hooks/useTickerSearch", () => ({
  useTickerSearch: () => ({
    query: "",
    setQuery: mockSetQuery,
    results: mockResults(),
    loading: mockLoading(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TickerSearch", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockResults.mockReturnValue([]);
    mockLoading.mockReturnValue(false);
  });

  it("renders trigger button with placeholder when no value", () => {
    render(<TickerSearch value="" onChange={onChange} />);
    const trigger = screen.getByTestId("ticker-search-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Search ticker...");
  });

  it("renders trigger button with value when provided", () => {
    render(<TickerSearch value="AAPL" onChange={onChange} />);
    expect(screen.getByTestId("ticker-search-trigger")).toHaveTextContent(
      "AAPL"
    );
  });

  it("renders custom label when provided", () => {
    render(<TickerSearch value="" onChange={onChange} label="Pick Ticker" />);
    expect(screen.getByText("Pick Ticker")).toBeInTheDocument();
  });

  it("renders custom placeholder", () => {
    render(
      <TickerSearch value="" onChange={onChange} placeholder="Type here..." />
    );
    expect(screen.getByTestId("ticker-search-trigger")).toHaveTextContent(
      "Type here..."
    );
  });

  it("disables the trigger when disabled=true", () => {
    render(<TickerSearch value="" onChange={onChange} disabled />);
    expect(screen.getByTestId("ticker-search-trigger")).toBeDisabled();
  });

  it("opens popover on click — trigger becomes expanded", async () => {
    render(<TickerSearch value="" onChange={onChange} />);
    const trigger = screen.getByTestId("ticker-search-trigger");
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("shows loading spinner when search is in progress", async () => {
    mockLoading.mockReturnValue(true);
    render(<TickerSearch value="" onChange={onChange} />);
    const trigger = screen.getByTestId("ticker-search-trigger");
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
    // The spinner is inside the popover content
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("has combobox role on trigger", () => {
    render(<TickerSearch value="" onChange={onChange} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});

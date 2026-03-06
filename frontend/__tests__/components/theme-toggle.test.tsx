import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

// ---------------------------------------------------------------------------
// Mock next-themes
// ---------------------------------------------------------------------------

const mockSetTheme = vi.fn();
let mockResolvedTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockResolvedTheme,
    resolvedTheme: mockResolvedTheme,
    setTheme: mockSetTheme,
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    mockResolvedTheme = "light";
  });

  it("renders a button with accessible label", () => {
    render(<ThemeToggle />);
    expect(screen.getByLabelText("Toggle theme")).toBeInTheDocument();
  });

  it("renders as a button element", () => {
    render(<ThemeToggle />);
    const btn = screen.getByLabelText("Toggle theme");
    expect(btn.tagName).toBe("BUTTON");
  });

  it('calls setTheme("dark") when resolved theme is light', () => {
    mockResolvedTheme = "light";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText("Toggle theme"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it('calls setTheme("light") when resolved theme is dark', () => {
    mockResolvedTheme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText("Toggle theme"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("renders both Sun and Moon icons (one hidden via CSS)", () => {
    render(<ThemeToggle />);
    const btn = screen.getByLabelText("Toggle theme");
    // Both SVGs should be present in the DOM (visibility toggled via CSS)
    const svgs = btn.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
  });
});

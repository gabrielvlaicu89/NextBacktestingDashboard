import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserMenu, getInitials } from "@/components/layout/user-menu";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

const mockUser = {
  name: "Jane Doe",
  email: "jane@example.com",
  image: "https://example.com/jane.jpg",
};

// ---------------------------------------------------------------------------
// getInitials unit tests
// ---------------------------------------------------------------------------

describe("getInitials", () => {
  it("returns first letters of each word, uppercased", () => {
    expect(getInitials("Jane Doe")).toBe("JD");
  });

  it("handles single word", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  it("truncates to 2 characters for long names", () => {
    expect(getInitials("Jean Luc Picard")).toBe("JL");
  });

  it('returns "U" for null', () => {
    expect(getInitials(null)).toBe("U");
  });

  it('returns "U" for undefined', () => {
    expect(getInitials(undefined)).toBe("U");
  });

  it('returns "U" for empty string', () => {
    expect(getInitials("")).toBe("U");
  });
});

// ---------------------------------------------------------------------------
// UserMenu component tests
// ---------------------------------------------------------------------------

describe("UserMenu", () => {
  it("renders user name in the trigger", () => {
    render(<UserMenu user={mockUser} />);
    expect(screen.getByTestId("user-name")).toHaveTextContent("Jane Doe");
  });

  it("renders user email in the trigger", () => {
    render(<UserMenu user={mockUser} />);
    expect(screen.getByTestId("user-email")).toHaveTextContent(
      "jane@example.com"
    );
  });

  it("renders trigger as accessible element", () => {
    render(<UserMenu user={mockUser} />);
    expect(screen.getByTestId("user-menu-trigger")).toBeInTheDocument();
  });

  it("shows 'User' when name is null", () => {
    render(<UserMenu user={{ email: "anon@example.com" }} />);
    expect(screen.getByTestId("user-name")).toHaveTextContent("User");
  });

  it("renders avatar fallback text when no image", () => {
    render(
      <UserMenu user={{ name: "Jane Doe", email: "jane@example.com" }} />
    );
    // Avatar fallback should show initials "JD"
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("renders avatar fallback 'U' when no name and no image", () => {
    render(<UserMenu user={{ email: "anon@example.com" }} />);
    expect(screen.getByText("U")).toBeInTheDocument();
  });
});

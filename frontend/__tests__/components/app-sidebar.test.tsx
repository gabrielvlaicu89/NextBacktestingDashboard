import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppSidebar, navItems } from "@/components/layout/app-sidebar";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPathname = vi.fn(() => "/dashboard");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
    resolvedTheme: "light",
  }),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

const mockUser = {
  name: "Test User",
  email: "test@example.com",
  image: "https://example.com/avatar.jpg",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AppSidebar", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/dashboard");
  });

  it("renders logo text", () => {
    render(<AppSidebar user={mockUser} />);
    expect(screen.getByText("Backtester")).toBeInTheDocument();
  });

  it("renders a navigation section with accessible label", () => {
    render(<AppSidebar user={mockUser} />);
    expect(screen.getByRole("navigation")).toHaveAttribute(
      "aria-label",
      "Sidebar navigation"
    );
  });

  it("renders all nav items with correct hrefs", () => {
    render(<AppSidebar user={mockUser} />);
    const nav = screen.getByRole("navigation");
    const links = nav.querySelectorAll("a");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/dashboard");
    expect(links[1]).toHaveAttribute("href", "/dashboard/new");
    expect(links[2]).toHaveAttribute("href", "/dashboard/compare");
  });

  it("renders Dashboard, New Backtest, Compare labels", () => {
    render(<AppSidebar user={mockUser} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("New Backtest")).toBeInTheDocument();
    expect(screen.getByText("Compare")).toBeInTheDocument();
  });

  it("highlights Dashboard link when pathname is /dashboard", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<AppSidebar user={mockUser} />);
    const link = screen.getByText("Dashboard").closest("a");
    expect(link?.className).toContain("bg-sidebar-accent");
  });

  it("does NOT highlight Dashboard when pathname is /dashboard/new", () => {
    mockPathname.mockReturnValue("/dashboard/new");
    render(<AppSidebar user={mockUser} />);
    const link = screen.getByText("Dashboard").closest("a");
    // Split on whitespace so we test exact class tokens.
    // The inactive state has "hover:bg-sidebar-accent/50" which is a different token
    // from the active "bg-sidebar-accent" — substring matching would false-positive.
    const classes = link?.className.split(/\s+/) ?? [];
    expect(classes).not.toContain("bg-sidebar-accent");
  });

  it("highlights New Backtest link when pathname is /dashboard/new", () => {
    mockPathname.mockReturnValue("/dashboard/new");
    render(<AppSidebar user={mockUser} />);
    const link = screen.getByText("New Backtest").closest("a");
    expect(link?.className).toContain("bg-sidebar-accent");
  });

  it("highlights Compare link when pathname starts with /dashboard/compare", () => {
    mockPathname.mockReturnValue("/dashboard/compare");
    render(<AppSidebar user={mockUser} />);
    const link = screen.getByText("Compare").closest("a");
    expect(link?.className).toContain("bg-sidebar-accent");
  });

  it("calls onNavClick when a nav link is clicked", () => {
    const onNavClick = vi.fn();
    render(<AppSidebar user={mockUser} onNavClick={onNavClick} />);
    fireEvent.click(screen.getByText("Dashboard"));
    expect(onNavClick).toHaveBeenCalledTimes(1);
  });

  it("does not crash when onNavClick is omitted", () => {
    render(<AppSidebar user={mockUser} />);
    // Clicking should not throw
    expect(() => fireEvent.click(screen.getByText("Dashboard"))).not.toThrow();
  });

  it("renders user name in user-menu trigger", () => {
    render(<AppSidebar user={mockUser} />);
    expect(screen.getByTestId("user-name")).toHaveTextContent("Test User");
  });

  it("renders user email in user-menu trigger", () => {
    render(<AppSidebar user={mockUser} />);
    expect(screen.getByTestId("user-email")).toHaveTextContent(
      "test@example.com"
    );
  });

  it("renders theme toggle button", () => {
    render(<AppSidebar user={mockUser} />);
    expect(screen.getByLabelText("Toggle theme")).toBeInTheDocument();
  });

  it("shows 'User' fallback when user has no name", () => {
    render(<AppSidebar user={{ email: "anon@example.com" }} />);
    expect(screen.getByTestId("user-name")).toHaveTextContent("User");
  });

  it("exports navItems constant with 3 items", () => {
    expect(navItems).toHaveLength(3);
    expect(navItems.map((n) => n.label)).toEqual([
      "Dashboard",
      "New Backtest",
      "Compare",
    ]);
  });
});

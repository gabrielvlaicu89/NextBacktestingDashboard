"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Plus,
  GitCompareArrows,
  PencilRuler,
  TrendingUp,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Backtest", href: "/dashboard/new", icon: Plus },
  {
    label: "Build Custom Stratergy",
    href: "/dashboard/build-custom-stratergy",
    icon: PencilRuler,
  },
  { label: "Compare", href: "/dashboard/compare", icon: GitCompareArrows },
]

interface AppSidebarProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  /** Called when a navigation link is clicked — used by the mobile Sheet to close itself. */
  onNavClick?: () => void
}

export function AppSidebar({ user, onNavClick }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <TrendingUp className="h-5 w-5 text-sidebar-primary" />
        <span className="text-lg font-semibold tracking-tight">
          Backtester
        </span>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 space-y-1 px-3 py-4"
        aria-label="Sidebar navigation"
      >
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Separator />

      {/* Bottom section */}
      <div className="flex items-center gap-2 px-3 py-3">
        <ThemeToggle />
      </div>

      <Separator />

      {/* User */}
      <div className="px-3 py-3">
        <UserMenu user={user} />
      </div>
    </div>
  )
}

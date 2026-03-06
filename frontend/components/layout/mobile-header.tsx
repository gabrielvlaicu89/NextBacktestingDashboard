"use client"

import { useState } from "react"
import { Menu, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { AppSidebar } from "@/components/layout/app-sidebar"

interface MobileHeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export function MobileHeader({ user }: MobileHeaderProps) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <span className="font-semibold">Backtester</span>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar user={user} onNavClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}

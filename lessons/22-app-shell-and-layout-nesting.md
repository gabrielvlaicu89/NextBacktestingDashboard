# Lesson 22 — App Shell Architecture: Layout Nesting, Auth Guards, and Responsive Sidebars

A "shell" is the persistent chrome that wraps every page inside a protected area — the
sidebar, header, and main content region that stay constant while the inner page changes.
Getting the shell right is foundational: it defines how auth is enforced, how navigation
works, and how the app responds to different screen sizes. This lesson covers every decision
made when building the dashboard shell for this platform.

---

## Section: How Next.js Layout Nesting Works

Next.js App Router treats `layout.tsx` files as **persistent wrappers**. When the user
navigates between pages inside the same directory, the layout re-uses its existing DOM node
and only re-renders the `{children}` slot. This means the sidebar never unmounts during
navigation — it stays mounted and stateful across route changes.

```
app/
├── layout.tsx           ← Root layout — wraps every page in the app: ThemeProvider,
│                          SessionProvider, ReduxProvider
├── page.tsx             ← Landing page — sits inside root layout only
├── (auth)/
│   ├── layout.tsx       ← Auth layout — centered card, no sidebar
│   └── login/page.tsx
└── dashboard/
    ├── layout.tsx        ← Dashboard layout — sidebar + main content
    └── page.tsx          ← Dashboard page — sits inside dashboard layout AND root layout
```

When a user visits `/dashboard`, Next.js renders three layouts in order:

```
<RootLayout>          ← app/layout.tsx
  <DashboardLayout>   ← app/dashboard/layout.tsx
    <DashboardPage /> ← app/dashboard/page.tsx
  </DashboardLayout>
</RootLayout>
```

When the user navigates to `/dashboard/new`, only `<DashboardPage />` is replaced — the
outer two layouts stay mounted. This is what makes the sidebar stateful: open/closed state,
hover state, and active link indicators persist across page changes.

The `(auth)` directory uses parentheses — a **Route Group**. Route groups don't create URL
segments; `/login` is still at `/login`, not `/(auth)/login`. Their only purpose is to scope
a layout to a subset of pages without affecting the URL structure.

---

## Section: Enforcing Auth at the Layout Level

Before Phase 5, each dashboard page independently checked the session and redirected:

```typescript
// Old pattern — repeated in every dashboard page
export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");   // duplicated in every single page
  ...
}
```

Phase 5 moved this check to `app/dashboard/layout.tsx`:

```typescript
// app/dashboard/layout.tsx

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();          // ① one auth check for all routes
  if (!session?.user) redirect("/login");            // ② covers every sub-route

  const user = {
    name:  session.user.name,
    email: session.user.email,
    image: session.user.image,
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
        <AppSidebar user={user} />
      </aside>
      <div className="flex flex-1 flex-col md:pl-64">
        <MobileHeader user={user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

**① One auth check covers every sub-route** — Because the layout wraps all pages under
`/dashboard/*`, any unauthenticated request to `/dashboard/new`, `/dashboard/results/abc`,
or any other sub-route hits the layout's auth check before the page component ever runs.
Pages no longer need to import and call `getServerSession`.

**② `session?.user` not just `session`** — NextAuth can return a session object with a
`user` key that's undefined if the adapter hasn't hydrated the user correctly. Checking
`session?.user` instead of just `session` guards against this edge case.

### Why not just use the middleware (`proxy.ts`)?

`proxy.ts` already redirects unauthenticated users away from `/dashboard/*`. Why check
again in the layout?

The middleware runs on the Edge Runtime — it can only read JWT cookies, not hit Prisma.
It's a fast, stateless gate that handles 99 % of cases. The layout runs on the Node.js
runtime and calls `getServerSession()`, which actually validates the token and loads the
user object from the database. This gives Components the typed `session.user.id`,
`session.user.name`, etc. The two checks serve different purposes and neither is redundant.

```
Request → Middleware (Edge)    → fast JWT cookie check → redirect if missing
       → Layout (Node.js)     → full session hydration → redirect if invalid
```

---

## Section: The Fixed Sidebar + Content Offset Pattern

The layout uses a CSS pattern common to app shells:

```tsx
<div className="flex min-h-screen">
  {/* Sidebar: fixed position, full viewport height */}
  <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
    <AppSidebar user={user} />
  </aside>

  {/* Content: normal flow, padded left to avoid the sidebar */}
  <div className="flex flex-1 flex-col md:pl-64">
    <MobileHeader user={user} />
    <main className="flex-1 p-6">{children}</main>
  </div>
</div>
```

The sidebar uses `position: fixed` (`md:fixed`) with `inset-y-0` (top: 0, bottom: 0). This
means it scrolls with the viewport, not the page — the nav stays visible even when content
scrolls.

The content div uses `md:pl-64` — 256px of left padding (matching the sidebar width) to
push content out from behind the fixed sidebar. This avoids the common mistake of absolutely
positioning the sidebar and having content overlap underneath it.

```
Viewport
┌────────────────────────────────────┐
│ Sidebar (fixed, z-30)              │
│ ┌──────────┐  Content (normal flow)│
│ │ Logo     │  ┌─────────────────┐  │
│ │ Nav      │  │ MobileHeader    │  │
│ │ Items    │  │ (sticky top-0)  │  │
│ │          │  ├─────────────────┤  │
│ │          │  │ <main>          │  │
│ │ Theme    │  │  {children}     │  │
│ │ User     │  │                 │  │
│ └──────────┘  └─────────────────┘  │
└────────────────────────────────────┘
  ← 256px →  ← pl-64 offsets this →
```

The sidebar is completely hidden on mobile (`hidden` — `display: none`) and only appears
at `md:` breakpoint (768px+). Below that, `MobileHeader` provides navigation.

---

## Section: Responsive Mobile Navigation with Sheet

On small screens, the sidebar is hidden and `MobileHeader` renders a sticky top bar with a
hamburger button. Tapping it opens a shadcn `Sheet` — a slide-in panel — that contains the
same `AppSidebar` component.

```typescript
// components/layout/mobile-header.tsx

"use client"

export function MobileHeader({ user }: MobileHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
      {/* ① Only renders on mobile (md:hidden) */}
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {/* ② Reuses the same AppSidebar with a close callback */}
          <AppSidebar user={user} onNavClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
```

**① `md:hidden`** — The mobile header is invisible at `md:` breakpoint and above. It and the
desktop sidebar are complementary: one appears while the other is hidden, always exactly
one visible at any viewport width.

**② Reusing `AppSidebar`** — The mobile sheet contains the exact same `AppSidebar`
component as the desktop. There's no separate mobile nav. The `onNavClick` prop is passed
so that clicking any navigation link closes the Sheet — without it the Sheet would stay
open after navigation.

```typescript
// components/layout/app-sidebar.tsx

{navItems.map((item) => (
  <Link
    key={item.href}
    href={item.href}
    onClick={onNavClick}   // ← closes Sheet on mobile, no-op on desktop
    ...
  >
    ...
  </Link>
))}
```

On desktop, `onNavClick` is `undefined` — passing `undefined` as an `onClick` handler is
safe in React, it's simply ignored. No separate check needed.

---

## Section: Active Link Detection

`AppSidebar` uses `usePathname()` from Next.js to determine which nav item is active:

```typescript
const pathname = usePathname();

const isActive =
  item.href === "/dashboard"
    ? pathname === "/dashboard"             // ① exact match for root
    : pathname.startsWith(item.href);      // ② prefix match for sub-routes
```

**① Exact match for `/dashboard`** — If we used `pathname.startsWith("/dashboard")` for the
Dashboard item, it would always be active (since every dashboard route starts with
`/dashboard`). Exact match here ensures only the workspace page activates the Dashboard nav
item.

**② Prefix match for other routes** — `/dashboard/new`, `/dashboard/results/abc` should all
activate the "New Backtest" and "Compare" items respectively. `startsWith` handles these
nested routes.

---

## Section: The `SheetTitle` Accessibility Requirement

Radix UI's `Dialog` (which `Sheet` is built on) requires a title element for screen readers.
Without it, the component throws a runtime warning. Since the `AppSidebar` already has
visible logo text, we don't want a redundant visible title:

```tsx
<SheetContent side="left" className="w-64 p-0">
  <SheetTitle className="sr-only">Navigation</SheetTitle>  {/* visually hidden, accessible */}
  <AppSidebar user={user} onNavClick={() => setOpen(false)} />
</SheetContent>
```

`sr-only` (screen reader only) is a Tailwind utility that positions the element off-screen with
zero size, making it invisible to sighted users but readable by screen readers. It satisfies
the accessibility requirement without adding visual clutter.

---

## Key Takeaway

> Place auth guards in `layout.tsx`, not in individual pages. Fixed sidebars with content offsets (`position: fixed` + `padding-left`) are the standard shell pattern. Reuse the same component in desktop and mobile contexts via a `Sheet`, using a callback prop to close the drawer on navigation.

---

**Next:** [Lesson 23 — Dark Mode with next-themes: Hydration, ThemeProvider, and suppressHydrationWarning](./23-dark-mode-and-next-themes.md)

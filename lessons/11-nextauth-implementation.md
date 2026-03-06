# Lesson 11 — Implementing NextAuth.js: Wiring the Pieces Together

In Lesson 07 we studied *how* OAuth works conceptually. In this lesson we look at the actual files we created and *why* they are structured the way they are. The goal is to understand the relationship between each file and what would break if any one of them were missing.

---

## The Dependency Graph

Every piece of the auth system depends on the one below it:

```
app/(auth)/login/page.tsx        ← user sees this
components/auth/login-card.tsx   ← "Sign in with Google" button
        ↓ calls signIn("google")
app/api/auth/[...nextauth]/route.ts   ← NextAuth entry point
        ↓ uses
lib/auth.ts (authOptions)             ← all configuration lives here
        ↓ uses
lib/prisma.ts                         ← database connection
        ↓ connects to
Supabase PostgreSQL                   ← User, Account tables
```

The session flows back up the same chain — from the cookie → NextAuth → `getServerSession()` → your Server Components.

---

## `lib/prisma.ts` — The Singleton

```ts
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Why not just `export const prisma = new PrismaClient()`?**

In Next.js development mode, the server hot-reloads every time you save a file. Each reload re-executes all module-level code. Without the singleton guard, you'd create a new `PrismaClient` instance on every hot reload. Each instance opens its own connection pool, and after a handful of reloads you'd hit Postgres's connection limit.

The fix: store the client on `globalThis`. Unlike module scope, `globalThis` survives hot reloads. On each reload, `globalForPrisma.prisma ?? new PrismaClient()` finds the existing instance and reuses it.

In production (`NODE_ENV === "production"`), there are no hot reloads, so we skip the `globalThis` assignment and just create a single instance that lives for the lifetime of the process.

---

## `lib/auth.ts` — The Central Config Object

```ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
};

export const getServerSession = () => nextAuthGetServerSession(authOptions);
```

**Why is all of this in `lib/auth.ts` and not in the route handler itself?**

The route handler at `app/api/auth/[...nextauth]/route.ts` is not the only place that needs `authOptions`. Every Server Component, every API route proxy, and every Server Action that needs to know who the user is calls `getServerSession(authOptions)`. If `authOptions` lived inside the route file, you'd have a circular import — the route handler imports from the route handler.

Centralising it in `lib/auth.ts` means there is exactly one definition, importable anywhere:

```ts
// In a Server Component
import { getServerSession } from "@/lib/auth";
const session = await getServerSession();

// In an API route
import { getServerSession } from "@/lib/auth";
if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
```

**The `!` non-null assertion on env vars**

`process.env.GOOGLE_CLIENT_ID!` — the `!` tells TypeScript "trust me, this is not undefined". Without it, TypeScript complains because `process.env.*` values are typed as `string | undefined`. We accept this risk because the app will crash loudly at startup if the env var is missing — that's actually the right behaviour for a required configuration value.

**The `callbacks` block**

By default, the JWT only contains the user's email and name. The callbacks let us customize what gets stored:

- `jwt` runs when a token is created or refreshed. We add `token.id = user.id` so the database user ID travels in the cookie.
- `session` runs when `getServerSession()` is called. We copy `token.id` → `session.user.id` so components can access it.

Without these callbacks, `session.user.id` would be `undefined`, making it impossible to do any user-scoped database queries.

---

## `app/api/auth/[...nextauth]/route.ts` — The Entry Point

```ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

This is intentionally minimal — just 4 lines. `NextAuth(authOptions)` returns a standard `Request → Response` handler. We export it as both `GET` and `POST` because:

- `GET /api/auth/*` handles redirects, session queries, and provider pages
- `POST /api/auth/*` handles sign-in and sign-out form submissions

The `[...nextauth]` catch-all segment matches every path under `/api/auth/`, so this one file handles the entire auth surface area.

---

## The Session Provider Wrapper

```ts
// components/providers/session-provider.tsx
"use client";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children, session }: Props) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
```

NextAuth's `SessionProvider` uses React Context to make the session available to all Client Components via `useSession()`. It must be a Client Component (it uses context and browser APIs).

**Why do we wrap it in our own component?**

The root `layout.tsx` is a Server Component. Server Components can't import Client Components that use React Context directly in the same file — the `"use client"` boundary must be its own file. The thin wrapper gives us that boundary.

**Why do we pass `session` from the server?**

```ts
// app/layout.tsx (Server Component)
const session = await getServerSession();
return (
  <SessionProvider session={session}> ... </SessionProvider>
);
```

If we didn't pre-fetch the session on the server, `SessionProvider` would ship an empty session to the browser and then immediately fire a request to `/api/auth/session` to hydrate it. That extra round-trip causes a flash of "unauthenticated" state. Passing the pre-fetched session eliminates that flash.

---

## The Login Page Structure

```
app/(auth)/layout.tsx        ← Server Component: centered card layout
app/(auth)/login/page.tsx    ← Server Component: checks session, renders LoginCard
components/auth/login-card.tsx  ← Client Component: calls signIn()
```

Three files instead of one — why the split?

1. **`layout.tsx`** is reusable. If we add a `/register` or `/forgot-password` page, they all get the centered layout for free.
2. **`page.tsx`** does the session check server-side (`if (session) redirect("/dashboard")`). This check runs *before* any HTML is sent to the browser. Without it, an authenticated user would see the login page flash before being redirected.
3. **`login-card.tsx`** must be a Client Component because `signIn()` from `next-auth/react` uses browser APIs. The Client/Server boundary is explicit — the card is the only part that needs the browser.

The `(auth)` folder name uses a **route group** — the parentheses tell Next.js to apply this layout without making `(auth)` part of the URL. The URL remains `/login`, not `/auth/login`.

---

## Types: Augmenting NextAuth's Interfaces

```ts
// types/next-auth.d.ts
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
  }
}
```

NextAuth's default `Session` type doesn't include `user.id`. If you try to access `session.user.id` without this augmentation, TypeScript throws a compile error.

Module augmentation (the `declare module` syntax) is the official TypeScript pattern for extending types defined in a third-party package. We extend both `Session` (for Server Components) and `JWT` (for the token callbacks) to keep everything consistent.

---

## Key Takeaway

> Auth systems look complex because they touch many files, but each file has exactly one job. `lib/prisma.ts` manages the database connection lifecycle. `lib/auth.ts` owns all configuration. The route handler is a thin adapter. The session provider bridges server and client. Understanding *why* each file exists makes the entire system readable.

---

**Next:** [Lesson 12 — JWT Sessions vs Database Sessions: A Debugging Story](./12-jwt-vs-database-sessions.md)

# Lesson 07 — Authentication Architecture

## Why "Google Only"?

We chose Google-only OAuth rather than email/password authentication. Here's why this was a deliberate product decision, not a shortcut:

- **No password management.** Storing passwords requires hashing (bcrypt), salting, reset flows, breach monitoring. All of that becomes Google's problem.
- **No email verification flow.** Google accounts are already verified.
- **Better security defaults.** Google enforces 2FA, detects suspicious logins, and handles phishing. Your users get all of that for free.
- **Faster MVP.** One OAuth provider is one integration. We can add GitHub, Microsoft, or magic links in Phase 2 if needed.

The trade-off: users without Google accounts can't log in. That's acceptable for this application.

## The Full OAuth Flow

Here's every step that happens when a user clicks "Sign in with Google":

```
1. User clicks "Sign in with Google"
   └→ Next.js calls: signIn("google")

2. NextAuth redirects browser to:
   https://accounts.google.com/o/oauth2/auth?
     client_id=YOUR_GOOGLE_CLIENT_ID
     &redirect_uri=https://yourapp.com/api/auth/callback/google
     &scope=openid email profile

3. Google shows its consent screen
   User clicks "Allow"

4. Google redirects back to:
   https://yourapp.com/api/auth/callback/google?code=AUTHORIZATION_CODE

5. NextAuth (server-side) exchanges the code for tokens:
   POST https://oauth2.googleapis.com/token
   → receives: access_token, id_token

6. NextAuth decodes the id_token to extract:
   { email, name, picture, sub (Google user ID) }

7. NextAuth Prisma Adapter:
   - Looks up User by email in database
   - If new user: INSERT INTO users, INSERT INTO accounts
   - If existing user: UPDATE account tokens

8. NextAuth creates a session (JWT or DB session)
   Sets a secure HttpOnly cookie

9. User is redirected to the dashboard
   Session cookie is sent on every subsequent request
```

You don't write any of steps 2–8. NextAuth handles the entire flow from the `[...nextauth]` route handler.

## The `[...nextauth]` Route

In the App Router, NextAuth is mounted at a catch-all route:

```
frontend/app/api/auth/[...nextauth]/route.ts
```

The `[...nextauth]` segment matches *any* path starting with `/api/auth/`:
- `/api/auth/signin` — renders sign-in page
- `/api/auth/callback/google` — handles OAuth callback
- `/api/auth/signout` — handles sign-out
- `/api/auth/session` — returns current session as JSON

This single file handles the entire auth surface.

## The Prisma Adapter

```ts
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [GoogleProvider({ ... })],
  session: { strategy: "jwt" },
}
```

The Prisma Adapter connects NextAuth to your database. It implements a set of functions (`createUser`, `getUser`, `linkAccount`, `createSession`, etc.) using Prisma. NextAuth calls these functions at the right points in the OAuth flow without you needing to write any SQL.

**Which tables does the adapter manage?**

| Table | Purpose |
|-------|---------|
| `User` | One row per unique person |
| `Account` | One row per OAuth provider per user (a user could link Google + GitHub) |
| `Session` | One row per active session (if using database sessions) |
| `VerificationToken` | Used for email magic-link sign-in (not currently active) |

These are the exact models in our `schema.prisma`.

## JWT vs Database Sessions

```ts
session: { strategy: "jwt" }
```

NextAuth supports two session strategies:

**JWT (JSON Web Token):**
- Session data is encrypted and stored in a cookie
- No database read on every request — the cookie is self-contained
- Slightly less secure (session can't be instantly invalidated)
- We use this: better performance, no extra DB queries on page load

**Database Sessions:**
- Session stored in the `Session` table
- Every request does a DB lookup to verify session
- More secure (instant revocation), but adds latency
- Useful for financial or security-sensitive applications

For a trading dashboard, JWT is fine. A user's session is short-lived anyway.

## Accessing the Session

**In a Server Component:**
```ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  
  return <div>Welcome, {session.user.name}</div>
}
```

**In a Client Component:**
```ts
"use client"
import { useSession } from "next-auth/react"

export function UserMenu() {
  const { data: session } = useSession()
  return <span>{session?.user?.name}</span>
}
```

**In an API Route:**
```ts
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return new Response("Unauthorized", { status: 401 })
  // handle request
}
```

## Route Protection with Middleware

`frontend/middleware.ts` runs on the Edge before any page renders:

```ts
export { default } from "next-auth/middleware"

export const config = {
  matcher: ["/dashboard/:path*", "/strategies/:path*"],
}
```

The `matcher` array tells Next.js which routes to protect. Any request to `/dashboard/*` that doesn't have a valid session is automatically redirected to the sign-in page — no code needed in the page components themselves.

This is more efficient than checking sessions inside each page because the check happens at the network edge, before any component renders or any data fetches.

## Key Takeaway

> NextAuth abstracts the entire OAuth dance into a few lines of configuration. The Prisma Adapter ensures users and their linked accounts are persisted automatically. Middleware provides route protection at the infrastructure level rather than the component level — making it impossible to accidentally expose a protected page.

---

**Next:** [Lesson 08 — Environment Variables & Security](./08-environment-variables-and-security.md)

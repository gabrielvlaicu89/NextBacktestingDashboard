# Lesson 12 — JWT Sessions vs Database Sessions: A Debugging Story

This lesson is built around a real bug we hit during Phase 2. Working through it teaches you more about how sessions, cookies, and middleware interact than any abstract explanation could.

---

## The Setup: We Started with Database Sessions

When we first wrote `lib/auth.ts`, the session strategy was:

```ts
session: { strategy: "database" }
```

This tells NextAuth to store session data in the `Session` database table. On every request, NextAuth would look up the session ID from the cookie, query the `Session` table, and return the session object.

This is the more "traditional" approach. It feels natural: sessions are stored on the server, invalidation is instant, and nothing sensitive travels in a cookie.

---

## The Bug: Infinite Redirect Loop

When we clicked "Sign in with Google" the browser showed:

> **Firefox has detected that the server is redirecting the request for this address in a way that will never complete.**

The request flow was:

```
User visits /dashboard
  → proxy.ts reads the session token cookie
  → No valid JWT found
  → Redirect to /login

/login loads
  → User clicks "Sign in with Google"
  → OAuth completes successfully
  → NextAuth sets a session cookie
  → Redirect to /dashboard

/dashboard
  → proxy.ts reads the session token cookie
  → Still no valid JWT found
  → Redirect to /login again ← 🔁 infinite loop
```

The login was actually succeeding — but the redirect loop happened immediately after.

---

## Why It Happened: The Middleware/Proxy Mismatch

The key is understanding what `proxy.ts` uses to verify a session:

```ts
// proxy.ts
import { withAuth } from "next-auth/middleware";

export default withAuth({ pages: { signIn: "/login" } });

export const config = { matcher: ["/dashboard/:path*"] };
```

`withAuth` from `next-auth/middleware` is designed to work at the **Edge Runtime** — the environment where Next.js middleware executes. The Edge Runtime cannot make database connections. It has no access to Postgres, Prisma, or any Node.js networking APIs.

So `withAuth` verifies sessions by doing exactly one thing: **checking for a valid JWT cookie**.

But we had configured `strategy: "database"`. With database sessions, NextAuth doesn't create a JWT cookie — it creates a different kind of session token (a random ID that maps to a row in the `Session` table). `withAuth` has no way to verify this token at the Edge, so it always sees "no valid session" and redirects to `/login`.

**The mismatch:**

| Component | What it expects | What was there |
|-----------|----------------|----------------|
| `proxy.ts` (Edge) | A JWT cookie | A database session ID cookie |
| NextAuth (server) | A database session ID → DB lookup | ✅ Worked fine |
| `withAuth` | JWT | ❌ Not found → redirect |

The login was working correctly at the server level. The database session was being created. But the middleware, running before the server ever gets a chance to respond, rejected every request to `/dashboard`.

---

## The Fix: Switching to JWT Strategy

```ts
session: { strategy: "jwt" }
```

With JWT sessions:

1. After sign-in, NextAuth creates a **signed, encrypted JWT** and stores it in an `HttpOnly` cookie
2. `withAuth` at the Edge decrypts and verifies this JWT using `NEXTAUTH_SECRET` — no database needed
3. The request proceeds to `/dashboard`

**An important nuance:** The Prisma Adapter still writes `User` and `Account` rows to the database on first sign-in. The difference is that the ongoing session is maintained via the JWT cookie, not via a `Session` database row.

```
With database sessions:                  With JWT sessions:
                                         
User → /dashboard                        User → /dashboard
  → proxy.ts checks cookie               → proxy.ts decrypts JWT in cookie
  → finds session ID                     → JWT valid ✅
  → DB lookup required ❌                → no DB needed ✅
  → Edge can't do DB                     → request proceeds
  → redirect loop ❌
```

---

## The Trade-off You're Accepting

Switching to JWT isn't free. There is one meaningful trade-off:

**Sessions cannot be instantly invalidated.**

With database sessions, you delete the row and the user's next request fails — instant logout from any device. With JWT, the token is valid until it expires (default: 30 days). If you want to force a user out before that, you'd need to build a token denylist — which essentially puts you back to a database lookup on every request.

For a trading dashboard, this trade-off is acceptable:

- There is no need for instant forced logout (this isn't a banking app)
- JWT sessions give us zero-latency route protection at the Edge
- Performance and simplicity outweigh the theoretical revocation risk

---

## The Stale Cookie Problem

After switching strategies, you may have seen errors like this in the terminal on the first page load:

```
[next-auth][error][JWT_SESSION_ERROR] Invalid Compact JWE
```

This happened because the browser still had the **old database session cookie** from before the strategy switch. That cookie contained a random session ID formatted as a database token — not a JWE (JSON Web Encryption) compact token. NextAuth tried to decrypt it as a JWT, failed, and logged the error.

This is harmless. NextAuth gracefully treats a failed session decode as "no session" and continues normally. The next successful sign-in replaces the old cookie with a valid JWT cookie, and the error never appears again.

**The lesson:** Changing session strategies mid-development always leaves stale cookies in browsers that were used during development. Clear browser cookies for `localhost` after switching strategies if you want a clean slate.

---

## How the JWT Callbacks Work

With `strategy: "jwt"`, session data flows through two callbacks:

```ts
callbacks: {
  // Called when a JWT is created (on sign-in) or refreshed
  async jwt({ token, user }) {
    if (user) {
      // `user` is only present on the initial sign-in
      token.id = user.id;  // write the DB user ID into the token
    }
    return token;
  },

  // Called when getServerSession() or useSession() is invoked
  async session({ session, token }) {
    if (session.user && token.id) {
      session.user.id = token.id as string;  // expose it to the app
    }
    return session;
  },
},
```

The `user` object in the `jwt` callback only exists on the **first sign-in** — not on subsequent requests. This is why the `if (user)` guard is necessary. On subsequent requests, NextAuth just decrypts the existing token and passes it through.

Data flow:

```
First sign-in:
  OAuth completes → user = { id, email, name, image }
  jwt callback:   token.id = user.id        ← stored in encrypted cookie
  
Every subsequent request:
  Cookie decrypted → token = { id, email, ... }
  session callback: session.user.id = token.id  ← available in components
```

---

## Key Takeaway

> The redirect loop bug taught us that **middleware runs in a different runtime environment than your server code**. The Edge cannot make database connections. Any session verification that middleware does must be self-contained — which is exactly what JWTs provide. Choosing a session strategy is not just an architectural preference; it affects what your middleware can and cannot do.

---

**Next:** [Lesson 13 — Environment Loading: Why `.env.local` Doesn't Just Work](./13-env-loading-and-prisma-config.md)

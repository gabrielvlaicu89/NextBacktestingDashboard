# Lesson 14 — Setting Up Google OAuth Credentials

Lesson 07 explained *what* happens during the OAuth flow. This lesson explains how to configure the thing that makes the flow possible — the Google OAuth credentials — and why each piece matters.

---

## What Google OAuth Credentials Actually Are

When you create an OAuth 2.0 client in Google Cloud Console, Google issues you two strings:

```
GOOGLE_CLIENT_ID     = 557856490204-xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

These are not like API keys where the key alone grants access. They work as a **matched pair** in a trust handshake:

- **Client ID** — identifies your application to Google. It is public. It appears in the browser's URL bar when the OAuth redirect happens. Anyone can see it.
- **Client Secret** — proves to Google that the server making the token exchange request is actually *your* server and not someone who just copied your Client ID. It must never be exposed to the browser.

This is why the Client Secret goes in `.env.local` (server-only, gitignored) and is accessed exclusively in `lib/auth.ts` which runs server-side. If the secret ever appears in client-side code or gets committed to git, revoke it immediately from Google Cloud Console and generate a new one.

---

## The OAuth Application Registration: What and Why

Before any user can sign in with Google, you must register your application with Google. This registration answers two questions from Google's perspective:

1. **Who is asking?** (answered by the Client ID)
2. **Where should I send the user back to after they authenticate?** (answered by the Authorized Redirect URI)

### The Redirect URI — The Most Common Source of Errors

When the user clicks "Allow" on Google's consent screen, Google sends them back to a URL you specified during registration. In our app that URL is:

```
http://localhost:3000/api/auth/callback/google
```

Google enforces an **exact match** between:
- The redirect URI registered in Google Cloud Console
- The redirect URI sent in the OAuth request at runtime

If they differ by even a single character (trailing slash, `http` vs `https`, wrong port), Google rejects the request with a `redirect_uri_mismatch` error. This is a security measure — it prevents a malicious site from initiating an OAuth flow on your behalf and having Google send the authorization code to *their* server instead of yours.

**For local development, register:**
```
http://localhost:3000/api/auth/callback/google
```

**When you deploy to production (e.g., Vercel), add a second URI:**
```
https://your-app.vercel.app/api/auth/callback/google
```

You can have multiple authorized redirect URIs. Each environment needs its own entry.

---

## The OAuth Consent Screen

Before you can create credentials, Google requires you to configure an **OAuth Consent Screen**. This is what users see when they click "Sign in with Google" — it shows your app name, logo, and what data you're requesting access to.

The key fields during setup:

| Field | What to put | Why it matters |
|---|---|---|
| **App name** | "Trading Backtester" | Shown to users on the consent screen |
| **User support email** | Your email | Required by Google for user-facing apps |
| **Developer contact email** | Your email | Google contacts you here about policy issues |
| **Scopes** | `email`, `profile`, `openid` | What data you request from the user's Google account |

**On scopes:** we only request the minimum — email, name, and profile picture. We don't request Google Drive, Calendar, or anything else. Users see exactly what you request, and requesting too many scopes damages trust and can trigger Google's verification process for sensitive scopes.

**User type — Internal vs External:**
- **Internal**: only users in your Google Workspace organisation can sign in. Useful for company tools.
- **External**: any Google account can sign in. This is what we use. In testing mode, only "test users" you explicitly add can sign in. Once you publish the app, anyone can.

---

## Where NextAuth Uses These Credentials

In `lib/auth.ts`:

```ts
GoogleProvider({
  clientId:     process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
}),
```

NextAuth's `GoogleProvider` is a pre-built integration that knows:
- Which Google endpoints to redirect to
- Which scopes to request (`openid email profile` by default)
- How to construct the redirect URI (it derives it from `NEXTAUTH_URL`)
- How to exchange the authorization code for tokens
- How to parse the `id_token` response

**The `NEXTAUTH_URL` connection:**

NextAuth derives the redirect URI it sends to Google from `NEXTAUTH_URL`:
```
NEXTAUTH_URL=http://localhost:3000
→ redirect_uri=http://localhost:3000/api/auth/callback/google
```

This is why `NEXTAUTH_URL` must exactly match the origin you registered in Google Cloud Console. In production, update this to your deployed URL.

---

## The Authorization Code Flow — What the Credentials Enable

The full exchange with credentials in context:

```
1. User clicks "Sign in with Google"

2. NextAuth redirects browser to Google:
   https://accounts.google.com/o/oauth2/auth
     ?client_id=557856490204-xxxx.apps.googleusercontent.com   ← Client ID (public)
     &redirect_uri=http://localhost:3000/api/auth/callback/google
     &response_type=code
     &scope=openid email profile

3. User approves on Google's consent screen

4. Google redirects to:
   http://localhost:3000/api/auth/callback/google?code=4/0AfrIep...

5. NextAuth (SERVER-SIDE) exchanges the code:
   POST https://oauth2.googleapis.com/token
     client_id=557856490204-xxxx.apps.googleusercontent.com
     client_secret=GOCSPX-xxxx                                 ← Secret (server only)
     code=4/0AfrIep...
     grant_type=authorization_code

6. Google responds with:
   { access_token, id_token, expires_in }

7. NextAuth decodes the id_token (a JWT):
   { email: "gabriel@gmail.com", name: "Gabriel", picture: "...", sub: "117..." }

8. Prisma Adapter: INSERT INTO "User" ... ON CONFLICT DO UPDATE ...
```

The critical security observation: the Client Secret is only used in step 5, which runs entirely on your server. The browser never touches it. The `code` that Google sends to the browser in step 4 is short-lived (valid for ~60 seconds) and single-use — even if someone intercepted it, they couldn't use it without also having the Client Secret.

---

## What to Do When You Deploy

When you move to production you'll need to:

1. Add the production redirect URI in Google Cloud Console:
   ```
   https://your-production-domain.com/api/auth/callback/google
   ```

2. Update environment variables on your hosting platform (Vercel):
   ```
   NEXTAUTH_URL=https://your-production-domain.com
   GOOGLE_CLIENT_ID=<same as local>
   GOOGLE_CLIENT_SECRET=<same as local>
   ```

3. If your app is still in "Testing" mode on Google's consent screen, add any additional test users, or publish the app to allow all Google accounts.

The Client ID and Client Secret are the same for all environments — you don't need separate Google credentials per environment. Only `NEXTAUTH_URL` and the redirect URI list need to account for each environment.

---

## Key Takeaway

> The Client ID is public — it identifies your app. The Client Secret is private — it proves your server is who it claims to be. The Redirect URI is a security constraint — Google will only send users back to URLs you pre-registered. Understanding these three pieces makes debugging OAuth errors (`redirect_uri_mismatch`, `invalid_client`, `access_denied`) straightforward: each error maps directly to one of these three things being wrong.

---

**Next:** [Lesson 15 — Coming in Phase 3: FastAPI Data Fetching](./15-fastapi-data-fetching.md)

import { withAuth } from "next-auth/middleware";

/**
 * Protect all routes under /dashboard.
 * Unauthenticated users are redirected to /login (defined in authOptions.pages).
 */
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/dashboard/:path*"],
};

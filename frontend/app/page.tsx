import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Root page — no UI, just redirects.
 * Authenticated  → /dashboard
 * Unauthenticated → /login
 *
 * The full marketing landing page will be built in Phase 5.
 */
export default async function HomePage() {
  const session = await getServerSession();
  if (session) redirect("/dashboard");
  redirect("/login");
}

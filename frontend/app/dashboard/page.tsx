import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Welcome, {session.user?.name ?? session.user?.email}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Dashboard coming soon — Phase 5.
        </p>
      </div>
    </div>
  );
}

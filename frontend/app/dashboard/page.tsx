import { getServerSession } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardPage() {
  // Auth is enforced by the dashboard layout — session is guaranteed here.
  const session = await getServerSession();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome back, {session?.user?.name?.split(" ")[0] ?? "there"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Your workspace is ready. Create a new backtest or review your saved
        strategies.
      </p>

      {/* Placeholder — Phase 8 will add strategy cards, filters, etc. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/new"
          className="group rounded-lg border border-dashed p-6 transition-colors hover:border-primary hover:bg-accent/50"
        >
          <h3 className="font-medium group-hover:text-primary">
            No strategies yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first backtest to get started.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-primary">
            New Backtest →
          </span>
        </Link>
      </div>
    </div>
  );
}

import { getServerSession } from "@/lib/auth";
import { getStrategies } from "@/lib/actions/strategies";
import { WorkspaceGrid } from "@/components/workspace/workspace-grid";

export default async function DashboardPage() {
  // Auth is enforced by the dashboard layout — session is guaranteed here.
  const session = await getServerSession();

  // Fetch strategies on the server (avoids client-side loading spinner)
  let strategies;
  try {
    strategies = await getStrategies();
  } catch {
    strategies = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {session?.user?.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your workspace is ready. Create a new backtest or review your saved
          strategies.
        </p>
      </div>

      <WorkspaceGrid initialStrategies={strategies} />
    </div>
  );
}

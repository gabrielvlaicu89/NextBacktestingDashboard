import { Skeleton } from "@/components/ui/skeleton";

export default function BuildCustomStrategyLoading() {
  return (
    <div className="space-y-6" data-testid="build-custom-strategy-loading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div
          className="space-y-6 rounded-xl border p-6"
          data-testid="build-custom-strategy-loading-main-column"
        >
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
          </div>

          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          </div>

          <div
            className="grid gap-4 xl:grid-cols-2"
            data-testid="build-custom-strategy-loading-rule-grid"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-52 w-full rounded-lg" />
            ))}
          </div>

          <Skeleton className="h-11 w-32" />
        </div>

        <div
          className="space-y-4 rounded-xl border p-6"
          data-testid="build-custom-strategy-loading-sidebar"
        >
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>

          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
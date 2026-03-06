import { Skeleton } from "@/components/ui/skeleton";

export default function OptimizeLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Form skeleton */}
      <div className="space-y-5 rounded-lg border p-5">
        <Skeleton className="h-4 w-40" />
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2 rounded-lg border p-4">
            <Skeleton className="h-4 w-28" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          </div>
        ))}
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

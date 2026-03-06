import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-5 w-96 animate-pulse rounded bg-muted" />
      </div>

      {/* Toolbar skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-[160px] animate-pulse rounded bg-muted" />
        <div className="h-10 w-[140px] animate-pulse rounded bg-muted" />
        <div className="h-10 w-[170px] animate-pulse rounded bg-muted" />
        <div className="flex-1" />
        <div className="h-10 w-[120px] animate-pulse rounded bg-muted" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 w-3/4 rounded bg-muted" />
              <div className="mt-1 h-4 w-1/2 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-3 w-2/5 rounded bg-muted" />
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="space-y-1">
                    <div className="h-3 w-12 rounded bg-muted" />
                    <div className="h-5 w-16 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <div className="h-8 w-24 rounded bg-muted" />
              <div className="h-8 w-20 rounded bg-muted" />
              <div className="h-8 w-16 rounded bg-muted" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

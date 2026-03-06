import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CompareLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-4 w-36 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded bg-muted" />
      </div>

      {/* Metrics table skeleton */}
      <section>
        <div className="mb-3 h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="overflow-x-auto rounded-lg border">
          <div className="h-64 animate-pulse bg-muted/30" />
        </div>
      </section>

      {/* Chart skeleton */}
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-5 w-56 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-96 rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}

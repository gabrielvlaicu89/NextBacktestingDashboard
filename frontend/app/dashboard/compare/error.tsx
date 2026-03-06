"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CompareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-xl font-semibold">Failed to load comparison</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || "Could not fetch strategy data."}
      </p>
      <div className="mt-4 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to Workspace</Link>
        </Button>
      </div>
    </div>
  );
}

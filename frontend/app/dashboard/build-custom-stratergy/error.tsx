"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BuildCustomStrategyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 text-center"
      data-testid="build-custom-strategy-error"
    >
      <h2 className="text-xl font-semibold">Failed to load custom builder</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        {error.message || "Could not load your saved custom strategy drafts."}
      </p>
      <div className="mt-4 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/new">Back to New Backtest</Link>
        </Button>
      </div>
    </div>
  );
}
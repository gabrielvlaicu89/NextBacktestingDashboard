"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function OptimizeError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[OptimizePage]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center space-y-4">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Failed to load optimization page</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={reset} variant="default">
            Try Again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to Workspace</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * OptimizeProgress — shows a progress bar + status message while the
 * optimization SSE stream is running.
 */

import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

export type OptimizeStatus = "idle" | "running" | "completed" | "error";

interface OptimizeProgressProps {
  status: OptimizeStatus;
  progress: number; // 0–100
  message: string;
}

export function OptimizeProgress({
  status,
  progress,
  message,
}: OptimizeProgressProps) {
  if (status !== "running") return null;

  return (
    <div data-testid="optimize-progress" className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
        <span>Optimizing…</span>
        <span className="ml-auto text-muted-foreground">
          {Math.round(progress)}%
        </span>
      </div>

      <Progress value={progress} className="h-2" aria-label="Optimization progress" />

      {message && (
        <p
          data-testid="optimize-progress-message"
          className="text-xs text-muted-foreground"
        >
          {message}
        </p>
      )}
    </div>
  );
}

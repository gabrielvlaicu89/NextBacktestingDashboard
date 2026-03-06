"use client";

/**
 * BacktestProgressBar — shows real-time progress while a backtest is running.
 *
 * Reads from the Redux backtest slice (status, progress, message).
 */
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface BacktestProgressBarProps {
  progress: number;
  message: string;
}

export function BacktestProgressBar({
  progress,
  message,
}: BacktestProgressBarProps) {
  return (
    <div
      className="flex flex-col items-center gap-4 py-16"
      data-testid="backtest-progress"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="w-full max-w-md space-y-2">
        <Progress value={progress} className="h-2" data-testid="progress-bar" />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span data-testid="progress-message">{message || "Starting…"}</span>
          <span data-testid="progress-percent">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * RunButton — validates the form, dispatches to Redux, triggers backtest stream.
 */
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RootState } from "@/store/store";
import { useAppSelector } from "@/store/hooks";

interface RunButtonProps {
  onRun: () => void;
  disabled?: boolean;
  label?: string;
}

export function RunButton({
  onRun,
  disabled = false,
  label = "Run Backtest",
}: RunButtonProps) {
  const status = useAppSelector((s: RootState) => s.backtest.status);
  const isRunning = status === "running";

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={disabled || isRunning}
      onClick={onRun}
      data-testid="run-backtest-button"
    >
      {isRunning ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Running Backtest…
        </>
      ) : (
        <>
          <Play className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  );
}

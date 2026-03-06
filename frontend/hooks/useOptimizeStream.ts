"use client";

/**
 * useOptimizeStream — streams grid-search optimization results from the backend.
 *
 * Unlike useBacktestStream (which uses EventSource for GET requests), this hook
 * uses the Fetch API with a ReadableStream because the optimization request
 * must be a POST (it sends a JSON payload).
 *
 * Usage:
 *   const { status, progress, message, results, error, startOptimize, abort } =
 *     useOptimizeStream();
 */

import { useCallback, useRef, useState } from "react";
import type { OptimizeConfig, OptimizeResultEntry } from "@/lib/types";

export type OptimizeStatus = "idle" | "running" | "completed" | "error";

export interface UseOptimizeStreamReturn {
  status: OptimizeStatus;
  progress: number;
  message: string;
  results: OptimizeResultEntry[] | null;
  error: string | null;
  startOptimize: (config: OptimizeConfig) => Promise<void>;
  abort: () => void;
}

export function useOptimizeStream(): UseOptimizeStreamReturn {
  const [status, setStatus] = useState<OptimizeStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<OptimizeResultEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const startOptimize = useCallback(async (config: OptimizeConfig) => {
    abort(); // cancel any in-flight request

    setStatus("running");
    setProgress(0);
    setMessage("Starting…");
    setResults(null);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Optimization request failed: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const trimmed = block.trim();
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            if (data.type === "progress") {
              setProgress(data.percent ?? 0);
              setMessage(data.message ?? "");
            } else if (data.type === "complete") {
              setResults(data.results as OptimizeResultEntry[]);
              setStatus("completed");
              setProgress(100);
            } else if (data.type === "error") {
              setError(data.message ?? "Optimization failed");
              setStatus("error");
            }
          } catch {
            // Ignore non-JSON blocks
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled — reset to idle silently
        setStatus("idle");
        return;
      }
      const msg = err instanceof Error ? err.message : "Optimization failed";
      setError(msg);
      setStatus("error");
    }
  }, [abort]);

  return { status, progress, message, results, error, startOptimize, abort };
}

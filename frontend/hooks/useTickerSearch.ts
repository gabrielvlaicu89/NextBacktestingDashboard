"use client";

/**
 * useTickerSearch — debounced ticker search via the Next.js proxy API.
 *
 * Usage:
 *   const { query, setQuery, results, loading } = useTickerSearch();
 *   <Input value={query} onChange={e => setQuery(e.target.value)} />
 *   {results.map(r => <div key={r.symbol}>{r.symbol} — {r.name}</div>)}
 */
import { useState, useEffect, useRef } from "react";
import type { TickerResult } from "@/lib/types";

export function useTickerSearch(debounceMs = 300) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear results immediately when query is too short
    if (!query || query.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const timer = setTimeout(async () => {
      // Abort any in-flight request before starting a new one
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/tickers?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });

        if (res.ok) {
          const data: TickerResult[] = await res.json();
          setResults(data);
        } else {
          setResults([]);
        }
      } catch (err) {
        // Ignore AbortError — it's expected when the query changes mid-request
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [query, debounceMs]);

  return { query, setQuery, results, loading };
}

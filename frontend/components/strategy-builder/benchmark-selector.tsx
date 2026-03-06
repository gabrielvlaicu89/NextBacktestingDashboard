"use client";

/**
 * BenchmarkSelector — ticker search defaulting to SPY for benchmark comparison.
 */
import { TickerSearch } from "@/components/strategy-builder/ticker-search";

interface BenchmarkSelectorProps {
  value: string;
  onChange: (ticker: string) => void;
  disabled?: boolean;
}

export function BenchmarkSelector({
  value,
  onChange,
  disabled = false,
}: BenchmarkSelectorProps) {
  return (
    <TickerSearch
      label="Benchmark Ticker"
      value={value}
      onChange={onChange}
      placeholder="SPY"
      disabled={disabled}
    />
  );
}

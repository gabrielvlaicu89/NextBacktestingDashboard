"use client";

/**
 * TickerSearch — shadcn Command combobox with debounced ticker search.
 *
 * Uses useTickerSearch hook under the hood. Dispatches setTicker to Redux.
 */
import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTickerSearch } from "@/hooks/useTickerSearch";

interface TickerSearchProps {
  value: string;
  onChange: (ticker: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

export function TickerSearch({
  value,
  onChange,
  placeholder = "Search ticker...",
  label,
  disabled = false,
}: TickerSearchProps) {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results, loading } = useTickerSearch();

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium leading-none">{label}</label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select ticker"
            disabled={disabled}
            className="w-full justify-between font-normal"
            data-testid="ticker-search-trigger"
          >
            {value || (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={query}
              onValueChange={setQuery}
              data-testid="ticker-search-input"
            />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loading && query.length > 0 && results.length === 0 && (
                <CommandEmpty>No tickers found.</CommandEmpty>
              )}
              {!loading && results.length > 0 && (
                <CommandGroup>
                  {results.map((item) => (
                    <CommandItem
                      key={item.symbol}
                      value={item.symbol}
                      onSelect={(sym) => {
                        onChange(sym.toUpperCase());
                        setQuery("");
                        setOpen(false);
                      }}
                      data-testid={`ticker-option-${item.symbol}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.symbol ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-medium">{item.symbol}</span>
                      <span className="ml-2 truncate text-xs text-muted-foreground">
                        {item.name}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

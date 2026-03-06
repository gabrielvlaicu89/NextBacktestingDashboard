"use client";

/**
 * DateRangePicker — two date inputs with Popover calendars for from/to selection.
 */
import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface DateRangePickerProps {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  onChange: (range: { from: string; to: string }) => void;
  disabled?: boolean;
}

function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function formatDate(date: Date | undefined): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

export function DateRangePicker({
  dateFrom,
  dateTo,
  onChange,
  disabled = false,
}: DateRangePickerProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const fromDate = parseDate(dateFrom);
  const toDate = parseDate(dateTo);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Date From */}
      <div className="space-y-2">
        <Label>Start Date</Label>
        <Popover open={fromOpen} onOpenChange={setFromOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateFrom && "text-muted-foreground"
              )}
              data-testid="date-from-trigger"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom || "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fromDate}
              onSelect={(date) => {
                onChange({ from: formatDate(date), to: dateTo });
                setFromOpen(false);
              }}
              disabled={(date) =>
                date > new Date() || (toDate ? date > toDate : false)
              }
              defaultMonth={fromDate}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Date To */}
      <div className="space-y-2">
        <Label>End Date</Label>
        <Popover open={toOpen} onOpenChange={setToOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateTo && "text-muted-foreground"
              )}
              data-testid="date-to-trigger"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo || "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={toDate}
              onSelect={(date) => {
                onChange({ from: dateFrom, to: formatDate(date) });
                setToOpen(false);
              }}
              disabled={(date) =>
                date > new Date() || (fromDate ? date < fromDate : false)
              }
              defaultMonth={toDate}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

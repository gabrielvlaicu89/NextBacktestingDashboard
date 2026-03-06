"use client";

/**
 * TradeLogTable — sortable, paginated data table of all trades.
 *
 * Uses TanStack Table for column sorting and pagination.
 * Color-coded P&L columns (green for profit, red for loss).
 */
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TradeResult } from "@/lib/types";

function pnlColor(value: number): string {
  if (value > 0) return "text-green-600 dark:text-green-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "";
}

const columns: ColumnDef<TradeResult>[] = [
  {
    accessorKey: "entry_date",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-3"
      >
        Entry Date
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.entry_date}</span>,
  },
  {
    accessorKey: "exit_date",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-3"
      >
        Exit Date
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.exit_date}</span>,
  },
  {
    accessorKey: "entry_price",
    header: "Entry Price",
    cell: ({ row }) => `$${row.original.entry_price.toFixed(2)}`,
  },
  {
    accessorKey: "exit_price",
    header: "Exit Price",
    cell: ({ row }) => `$${row.original.exit_price.toFixed(2)}`,
  },
  {
    accessorKey: "pnl",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-3"
      >
        P&L ($)
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const val = row.original.pnl;
      return (
        <span className={cn("font-medium", pnlColor(val))}>
          {val >= 0 ? "+" : ""}${val.toFixed(2)}
        </span>
      );
    },
  },
  {
    accessorKey: "pnl_pct",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-3"
      >
        P&L (%)
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const val = row.original.pnl_pct;
      return (
        <span className={cn("font-medium", pnlColor(val))}>
          {val >= 0 ? "+" : ""}{val.toFixed(2)}%
        </span>
      );
    },
  },
  {
    accessorKey: "holding_days",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-3"
      >
        Days
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => row.original.holding_days,
  },
  {
    accessorKey: "exit_reason",
    header: "Exit Reason",
    cell: ({ row }) => (
      <span className="text-xs capitalize">{row.original.exit_reason}</span>
    ),
  },
];

interface TradeLogTableProps {
  trades: TradeResult[];
  pageSize?: number;
}

export function TradeLogTable({
  trades,
  pageSize = 10,
}: TradeLogTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo(() => trades, [trades]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  });

  if (trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade Log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No trades recorded.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="trade-log-table">
      <CardHeader>
        <CardTitle>
          Trade Log{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({trades.length} trades)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-testid={`trade-row-${row.index}`}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              data-testid="trade-log-prev"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              data-testid="trade-log-next"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

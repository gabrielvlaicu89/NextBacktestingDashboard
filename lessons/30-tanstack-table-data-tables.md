# Lesson 30 — Sortable Data Tables with TanStack Table and the Save-as-Experiment Dialog

Raw data — trade logs, parameter grids, strategy comparisons — needs **interactive tables**: sortable columns, pagination, and per-cell formatting. This lesson covers how TanStack Table (headless) pairs with shadcn's `<Table>` (styled) to create the trade log, and how the Save-as-Experiment dialog implements client-side tag management with server action persistence.

---

## Section: Headless vs Styled — Why TanStack Table + shadcn

TanStack Table (formerly React Table) is **headless**: it manages sorting state, pagination math, and column definitions, but renders **zero** HTML. You bring your own `<table>`, `<tr>`, `<td>` markup — or in our case, shadcn's pre-styled `<Table>` components.

| Aspect | Headless (TanStack) | Full UI (AG Grid, etc.) |
|---|---|---|
| Markup control | You own every element | Library dictates structure |
| Styling | Your CSS / Tailwind / shadcn | Library's theme system |
| Bundle size | ~15 KB | 200–500 KB |
| Features | Opt-in (sorting, pagination, filtering) | Everything included (heavy) |
| Learning curve | Moderate (understand the abstraction) | Low (use props) |

For this project, we need a lightweight solution that matches our shadcn design system. TanStack Table + shadcn `<Table>` is the natural pairing.

---

## Section: Defining Columns with Type Safety

Column definitions are the heart of TanStack Table. Each column maps a data key to a header and a cell renderer:

```tsx
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

const columns: ColumnDef<TradeResult>[] = [
  {
    accessorKey: "entry_date",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Entry Date
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{row.original.entry_date}</span>
    ),
  },
  {
    accessorKey: "entry_price",
    header: "Entry Price",            // Simple string — no sorting
    cell: ({ row }) => `$${row.original.entry_price.toFixed(2)}`,
  },
  {
    accessorKey: "pnl",
    header: ({ column }) => (/* sortable header */),
    cell: ({ row }) => {
      const val = row.original.pnl;
      return (
        <span className={cn("font-medium", pnlColor(val))}>
          {val >= 0 ? "+" : ""}${val.toFixed(2)}
        </span>
      );
    },
  },
  // ... more columns
];
```

Three patterns to notice:

1. **Sortable headers use a function.** The `header` property accepts either a string (static text) or a function that receives `{ column }`. To make a column sortable, we render a `<Button>` that calls `column.toggleSorting()`. Non-sortable columns like "Entry Price" use a plain string.

2. **`row.original` gives type-safe access.** Because `columns` is typed as `ColumnDef<TradeResult>[]`, the `row.original` object is typed as `TradeResult`. No casting needed to access `entry_price`, `pnl`, etc.

3. **Color coding is a pure function.** The `pnlColor` helper returns a Tailwind class based on sign:

```tsx
function pnlColor(value: number): string {
  if (value > 0) return "text-green-600 dark:text-green-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "";
}
```

---

## Section: Wiring the Table Instance

The table instance connects data, columns, and features:

```tsx
export function TradeLogTable({ trades, pageSize = 10 }: TradeLogTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo(() => trades, [trades]);

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
```

**Feature models are opt-in.** Each `get*RowModel()` function adds a capability:

| Model | What it enables |
|---|---|
| `getCoreRowModel()` | Basic row rendering (required) |
| `getSortedRowModel()` | Column sorting |
| `getPaginationRowModel()` | Page slicing |

If you don't call `getSortedRowModel()`, sorting buttons do nothing. If you don't call `getPaginationRowModel()`, all rows render on one page.

**Sorting state is controlled.** TanStack Table doesn't own the sorting state — we pass it in via `state: { sorting }` and update it via `onSortingChange: setSorting`. This "controlled component" pattern lets you persist sorting to URL params or Redux if needed.

---

## Section: Rendering with flexRender

The render loop connects TanStack's row model to shadcn's `<Table>` components:

```tsx
<Table>
  <TableHeader>
    {table.getHeaderGroups().map((hg) => (
      <TableRow key={hg.id}>
        {hg.headers.map((header) => (
          <TableHead key={header.id}>
            {header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext())}
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
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

`flexRender` is the bridge between TanStack's column definitions and React's JSX. It takes a column definition (which can be a string, a function, or a component) and renders it with the correct context. This is what makes TanStack Table "headless" — it handles the logic; `flexRender` + your markup handles the pixels.

---

## Section: Pagination Controls

Pagination is built from TanStack's API methods:

```tsx
<div className="mt-4 flex items-center justify-between">
  <p className="text-sm text-muted-foreground">
    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
  </p>
  <div className="flex gap-2">
    <Button
      onClick={() => table.previousPage()}
      disabled={!table.getCanPreviousPage()}
      data-testid="trade-log-prev"
    >
      Previous
    </Button>
    <Button
      onClick={() => table.nextPage()}
      disabled={!table.getCanNextPage()}
      data-testid="trade-log-next"
    >
      Next
    </Button>
  </div>
</div>
```

Notice the symmetry: `previousPage()` / `getCanPreviousPage()` and `nextPage()` / `getCanNextPage()`. TanStack Table handles the math — you just call methods and check booleans.

The `data-testid` attributes are critical for testing pagination without relying on button text matching, which can break if you add icons or change labels.

---

## Section: The Save-as-Experiment Dialog — Client-Side Tag Management

The `SaveExperimentDialog` combines shadcn's `Dialog` with custom tag management logic. This is a pattern you'll reuse anywhere you need a workflow that collects multiple items before saving.

### State shape

```tsx
const [open, setOpen] = useState(false);
const [name, setName] = useState(currentName);
const [tags, setTags] = useState<string[]>(currentTags);
const [tagInput, setTagInput] = useState("");
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
```

Six state variables may seem like a lot, but each serves a distinct purpose:

| State | Purpose |
|---|---|
| `open` | Controls dialog visibility |
| `name` | Experiment name (pre-filled with current) |
| `tags` | Array of tag strings (pre-filled with current) |
| `tagInput` | Current text in the tag input (pending, not yet added) |
| `saving` | Loading state during server action call |
| `error` | Error message from validation or server failure |

### Tag management lifecycle

```
User types "momentum" → tagInput = "momentum"
User clicks Add (or presses Enter) → tags = [...tags, "momentum"], tagInput = ""
User clicks X on "momentum" badge → tags = tags.filter(t => t !== "momentum")
```

The `handleAddTag` function normalises tags to lowercase and prevents duplicates:

```tsx
const handleAddTag = useCallback(() => {
  const trimmed = tagInput.trim().toLowerCase();
  if (trimmed && !tags.includes(trimmed)) {
    setTags((prev) => [...prev, trimmed]);
  }
  setTagInput("");
}, [tagInput, tags]);
```

### Server action saves

On save, the dialog calls the `updateStrategy` server action:

```tsx
const handleSave = useCallback(async () => {
  if (!name.trim()) {
    setError("Name is required");
    return;
  }

  setSaving(true);
  setError(null);

  try {
    await updateStrategy(strategyId, { name: name.trim(), tags });
    onSaved?.(name.trim(), tags);
    setOpen(false);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to save experiment");
  } finally {
    setSaving(false);
  }
}, [strategyId, name, tags, onSaved]);
```

The `try/catch/finally` pattern ensures `saving` is always reset — even if the server action throws. The `onSaved` callback lets the parent component react to a successful save (e.g., refresh the page title).

---

## Section: Why `useCallback` on Every Handler

Every handler in the dialog uses `useCallback`:

```tsx
const handleAddTag = useCallback(() => { /* ... */ }, [tagInput, tags]);
const handleRemoveTag = useCallback((tag: string) => { /* ... */ }, []);
const handleKeyDown = useCallback((e: React.KeyboardEvent) => { /* ... */ }, [handleAddTag]);
const handleSave = useCallback(async () => { /* ... */ }, [strategyId, name, tags, onSaved]);
```

Is this premature optimisation? In this case, no — and here's why:

1. **`handleKeyDown` depends on `handleAddTag`:** Without `useCallback`, `handleAddTag` would be a new reference every render, causing `handleKeyDown` to also be a new reference every render, causing the `<Input>` to re-bind its `onKeyDown` prop every render.

2. **`handleRemoveTag` is passed into a `.map()` loop:** Each `<Badge>` receives `() => handleRemoveTag(tag)`. If `handleRemoveTag` changes reference, every badge re-renders.

3. **Consistent style:** When some handlers need `useCallback` and others don't, mixing styles makes the code harder to scan. Using it everywhere in a dialog (where there are many inter-dependent handlers) is a reasonable convention.

---

## Key Takeaway

> TanStack Table is headless by design — it owns the logic (sorting, pagination, filtering) while you own every pixel of markup. This pairs perfectly with shadcn's styled `<Table>` components: TanStack decides **which** rows to show and in **what** order; shadcn decides **how** they look.

---

**Next:** [Lesson 31 — Testing Canvas Charts, Dialogs, and Redux-Connected Dashboards](./31-testing-charts-dialogs-redux.md)

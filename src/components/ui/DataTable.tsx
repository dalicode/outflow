import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { cn } from "../../utils/cn";
import EmptyState from "./EmptyState";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends unknown, TValue> {
    className?: string;
    cellClassName?: string;
    getCellClassName?: (row: TData) => string;
    width?: string;
  }
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  emptyMessage?: string;
  fixedLayout?: boolean;
  getRowClassName?: (row: T) => string;
  getRowId?: (row: T) => string;
  onRowContextMenu?: (e: React.MouseEvent, row: T) => void;
  onRowTouchStart?: (e: React.TouchEvent, row: T) => void;
  onRowTouchMove?: (e: React.TouchEvent) => void;
  onRowTouchEnd?: (e: React.TouchEvent, row: T) => void;
}

export default function DataTable<T>({
  data,
  columns,
  emptyMessage = "No rows to display.",
  fixedLayout = false,
  getRowClassName,
  getRowId,
  onRowContextMenu,
  onRowTouchStart,
  onRowTouchMove,
  onRowTouchEnd,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <EmptyState message={emptyMessage} />
    );
  }

  return (
    <table
      className={cn(
        "w-full text-sm border-separate border-spacing-0",
        fixedLayout && "table-fixed",
      )}
    >
      {fixedLayout && (
        <colgroup>
          {table.getVisibleLeafColumns().map((column) => (
            <col
              key={column.id}
              style={
                column.columnDef.meta?.width
                  ? { width: column.columnDef.meta.width }
                  : undefined
              }
            />
          ))}
        </colgroup>
      )}
      <thead className="sticky top-0 z-10">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                className={cn(
                  "table-header-cell",
                  header.column.columnDef.meta?.className,
                )}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            data-testid={getRowId?.(row.original)}
            className={cn(
              "border-b border-theme-muted-subtle",
              getRowClassName?.(row.original),
            )}
            onContextMenu={
              onRowContextMenu
                ? (e) => onRowContextMenu(e, row.original)
                : undefined
            }
            onTouchStart={
              onRowTouchStart
                ? (e) => onRowTouchStart(e, row.original)
                : undefined
            }
            onTouchMove={onRowTouchMove}
            onTouchEnd={
              onRowTouchEnd ? (e) => onRowTouchEnd(e, row.original) : undefined
            }
          >
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className={cn(
                  "px-3 py-1",
                  cell.column.columnDef.meta?.cellClassName,
                  cell.column.columnDef.meta?.getCellClassName?.(row.original),
                )}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

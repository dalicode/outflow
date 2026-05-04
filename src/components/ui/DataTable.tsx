import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { cn } from "../../utils/cn";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends unknown, TValue> {
    className?: string;
    cellClassName?: string;
    getCellClassName?: (row: TData) => string;
  }
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  emptyMessage?: string;
  getRowClassName?: (row: T) => string;
  onRowContextMenu?: (e: React.MouseEvent, row: T) => void;
  onRowTouchStart?: (e: React.TouchEvent, row: T) => void;
  onRowTouchMove?: (e: React.TouchEvent) => void;
  onRowTouchEnd?: (e: React.TouchEvent, row: T) => void;
}

export default function DataTable<T>({
  data,
  columns,
  emptyMessage = "No rows to display.",
  getRowClassName,
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
      <p className="text-sm text-theme-muted text-center py-8">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
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
                onRowTouchEnd
                  ? (e) => onRowTouchEnd(e, row.original)
                  : undefined
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
    </div>
  );
}

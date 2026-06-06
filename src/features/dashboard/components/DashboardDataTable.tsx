import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { cn } from '../../../lib/cn'
import EmptyState from '../../../components/ui/EmptyState'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    className?: string
    cellClassName?: string
    getCellClassName?: (row: TData) => string
    onBodyCellPointerDown?: (e: React.PointerEvent<HTMLTableCellElement>, row: TData) => void
    width?: string
    ariaSort?: React.AriaAttributes['aria-sort']
  }
}

interface DashboardDataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  emptyMessage?: string
  fixedLayout?: boolean
  headerCellClassName?: string
  bodyCellClassName?: string
  getRowClassName?: (row: T) => string
  getRowTestId?: (row: T) => string
  onRowContextMenu?: (e: React.MouseEvent, row: T) => void
  onRowTouchStart?: (e: React.TouchEvent, row: T) => void
  onRowTouchMove?: (e: React.TouchEvent) => void
  onRowTouchEnd?: (e: React.TouchEvent, row: T) => void
  removeLastRowBottomBorder?: boolean
}

export default function DashboardDataTable<T>({
  data,
  columns,
  emptyMessage = 'No rows to display.',
  fixedLayout = false,
  headerCellClassName,
  bodyCellClassName,
  getRowClassName,
  getRowTestId,
  onRowContextMenu,
  onRowTouchStart,
  onRowTouchMove,
  onRowTouchEnd,
  removeLastRowBottomBorder = false,
}: DashboardDataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const rows = table.getRowModel().rows

  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <table
      className={cn(
        'w-full text-sm border-separate border-spacing-0',
        !removeLastRowBottomBorder && 'border-b border-theme-muted-subtle',
        fixedLayout && 'table-fixed',
      )}
    >
      {fixedLayout && (
        <colgroup>
          {table.getVisibleLeafColumns().map((column) => (
            <col
              key={column.id}
              style={
                column.columnDef.meta?.width ? { width: column.columnDef.meta.width } : undefined
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
                aria-sort={header.column.columnDef.meta?.ariaSort}
                className={cn(
                  'table-header-cell',
                  headerCellClassName,
                  header.column.columnDef.meta?.className,
                )}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr
            key={row.id}
            data-testid={getRowTestId?.(row.original)}
            className={cn(getRowClassName?.(row.original))}
            onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(e, row.original) : undefined}
            onTouchStart={onRowTouchStart ? (e) => onRowTouchStart(e, row.original) : undefined}
            onTouchMove={onRowTouchMove}
            onTouchEnd={onRowTouchEnd ? (e) => onRowTouchEnd(e, row.original) : undefined}
          >
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                onPointerDown={
                  cell.column.columnDef.meta?.onBodyCellPointerDown
                    ? (e) => cell.column.columnDef.meta?.onBodyCellPointerDown?.(e, row.original)
                    : undefined
                }
                className={cn(
                  'px-3 py-1 border-r border-b border-theme-muted-subtle last:border-r-0',
                  removeLastRowBottomBorder && rowIndex === rows.length - 1 && 'border-b-0',
                  bodyCellClassName,
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
  )
}

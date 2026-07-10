"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

export interface ColumnDef<TRow> {
  key: string;
  header: React.ReactNode;
  /** Selector or render. */
  cell: (row: TRow) => React.ReactNode;
  /** When provided, header becomes a sort button. */
  sortable?: boolean;
  width?: string; // e.g. 'w-32'
  align?: "left" | "right" | "center";
  className?: string;
}

export interface TableProps<TRow> {
  rows: TRow[];
  columns: ColumnDef<TRow>[];
  /** Stable id selector - required for selection + React keys. */
  rowKey: (row: TRow) => string;
  /** Multi-select state. Omit to disable selection. */
  selection?: {
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
  };
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  loading?: boolean;
  /** Rendered when rows.length === 0 and not loading. */
  empty?: React.ReactNode;
  /** Row click handler. */
  onRowClick?: (row: TRow) => void;
  className?: string;
}

export function Table<TRow>({
  rows,
  columns,
  rowKey,
  selection,
  sort,
  onSortChange,
  loading,
  empty,
  onRowClick,
  className,
}: TableProps<TRow>) {
  const allIds = React.useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const allSelected =
    selection && allIds.length > 0 && allIds.every((id) => selection.selected.has(id));
  const someSelected =
    selection && !allSelected && allIds.some((id) => selection.selected.has(id));

  const toggleAll = () => {
    if (!selection) return;
    if (allSelected) {
      const next = new Set(selection.selected);
      allIds.forEach((id) => next.delete(id));
      selection.onChange(next);
    } else {
      const next = new Set(selection.selected);
      allIds.forEach((id) => next.add(id));
      selection.onChange(next);
    }
  };

  const toggleOne = (id: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  const handleSort = (col: ColumnDef<TRow>) => {
    if (!col.sortable || !onSortChange) return;
    if (sort?.key === col.key) {
      onSortChange({ key: col.key, dir: sort.dir === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ key: col.key, dir: "asc" });
    }
  };

  return (
    <div className={cn("w-full overflow-x-auto rounded-md border border-neutral-200", className)}>
      <table className="w-full border-collapse text-sm">
        <thead className="bg-neutral-50 text-neutral-600">
          <tr>
            {selection ? (
              <th scope="col" className="w-4 px-2 py-1.5 text-left">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  className="h-2 w-2 cursor-pointer accent-ink"
                  checked={Boolean(allSelected)}
                  ref={(el) => {
                    if (el) el.indeterminate = Boolean(someSelected);
                  }}
                  onChange={toggleAll}
                />
              </th>
            ) : null}
            {columns.map((col) => (
              <th
                scope="col"
                key={col.key}
                className={cn(
                  "px-2 py-1.5 text-xs font-medium uppercase tracking-wider",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  !col.align && "text-left",
                  col.width,
                  col.className,
                )}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(col)}
                    className="inline-flex items-center gap-0.5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    {col.header}
                    {sort?.key === col.key ? (
                      sort.dir === "asc" ? (
                        <ChevronUp className="h-1.5 w-1.5" aria-hidden />
                      ) : (
                        <ChevronDown className="h-1.5 w-1.5" aria-hidden />
                      )
                    ) : (
                      <span className="inline-block h-1.5 w-1.5 opacity-0 group-hover:opacity-50" aria-hidden />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-paper">
          {loading ? (
            <tr>
              <td colSpan={columns.length + (selection ? 1 : 0)} className="px-2 py-6 text-center text-sm text-neutral-500">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selection ? 1 : 0)} className="px-2 py-6 text-center text-sm text-neutral-500">
                {empty ?? "No results."}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = rowKey(row);
              const isSelected = Boolean(selection?.selected.has(id));
              return (
                <tr
                  key={id}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(
                    "transition-colors duration-hover",
                    isSelected ? "bg-neutral-50" : "hover:bg-neutral-50",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selection ? (
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        className="h-2 w-2 cursor-pointer accent-ink"
                        checked={isSelected}
                        onChange={() => toggleOne(id)}
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-2 py-1.5 align-middle text-ink",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

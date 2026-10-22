"use client";

import { useMemo, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Loader2, Play, SearchX, Table2 } from "lucide-react";
import { translate, translateMessage, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { compareCellValues, formatCellValue } from "@/lib/report-format";
import type { ReportResult } from "@/types/report";
import type { TableSort } from "@/app/report/hooks/useReportBuilder";

interface ResultsPaneProps {
  result: ReportResult | null;
  columns: string[];
  isLoading: boolean;
  error: string | null;
  canRun: boolean;
  tableSort: TableSort | null;
  onTableSort: (sort: TableSort | null) => void;
  onReorder: (order: string[]) => void;
  onRun: () => void;
}

export function ResultsPane({
  result,
  columns,
  isLoading,
  error,
  canRun,
  tableSort,
  onTableSort,
  onReorder,
  onRun,
}: ResultsPaneProps) {
  useLanguage();

  if (isLoading) {
    return (
      <StateBox>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">{translate("Running your report…")}</p>
      </StateBox>
    );
  }

  if (error) {
    return (
      <StateBox>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="max-w-md space-y-1 text-center">
          <p className="text-sm font-semibold">{translate("The report couldn't run")}</p>
          <p className="text-xs text-muted-foreground">{translateMessage(error)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRun} disabled={!canRun}>
          {translate("Try again")}
        </Button>
      </StateBox>
    );
  }

  if (!result) {
    return (
      <StateBox>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Table2 className="h-6 w-6" />
        </div>
        <div className="max-w-sm space-y-1 text-center">
          <p className="text-sm font-semibold">{translate("Build your report")}</p>
          <p className="text-xs text-muted-foreground">
            {translate("Pick columns on the left, then run the report to see the results here.")}
          </p>
        </div>
        <Button size="sm" onClick={onRun} disabled={!canRun} className="shadow-md shadow-primary/20">
          <Play className="h-3.5 w-3.5 fill-current" />
          {translate("Run report")}
        </Button>
      </StateBox>
    );
  }

  if (result.rows.length === 0) {
    return (
      <StateBox>
        <SearchX className="h-10 w-10 text-muted-foreground/60" />
        <div className="max-w-sm space-y-1 text-center">
          <p className="text-sm font-semibold">{translate("No results found")}</p>
          <p className="text-xs text-muted-foreground">
            {translate("Nothing matched this report. Try removing a filter or widening the columns.")}
          </p>
        </div>
      </StateBox>
    );
  }

  return (
    <ResultsTable
      result={result}
      columns={columns}
      tableSort={tableSort}
      onTableSort={onTableSort}
      onReorder={onReorder}
    />
  );
}

function StateBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border p-8">
      {children}
    </div>
  );
}

interface ResultsTableProps {
  result: ReportResult;
  columns: string[];
  tableSort: TableSort | null;
  onTableSort: (sort: TableSort | null) => void;
  onReorder: (order: string[]) => void;
}

function ResultsTable({ result, columns, tableSort, onTableSort, onReorder }: ResultsTableProps) {
  // Pointer distance keeps a plain click on a header sorting, while a real drag reorders.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const rows = useMemo(() => {
    if (!tableSort) return result.rows;
    const direction = tableSort.direction === "asc" ? 1 : -1;
    return [...result.rows].sort(
      (a, b) => direction * compareCellValues(a[tableSort.column], b[tableSort.column]),
    );
  }, [result.rows, tableSort]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = columns.indexOf(String(active.id));
    const to = columns.indexOf(String(over.id));
    onReorder(arrayMove(columns, from, to));
  };

  const cycleSort = (column: string) => {
    if (tableSort?.column !== column) return onTableSort({ column, direction: "asc" });
    if (tableSort.direction === "asc") return onTableSort({ column, direction: "desc" });
    onTableSort(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
      <div className="min-h-0 flex-1 overflow-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns} strategy={horizontalListSortingStrategy}>
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 w-12 border-b border-border/60 bg-muted px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    #
                  </th>
                  {columns.map((column) => (
                    <HeaderCell
                      key={column}
                      column={column}
                      sort={tableSort?.column === column ? tableSort.direction : null}
                      onSort={() => cycleSort(column)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="group transition-colors duration-150 hover:bg-muted/40">
                    <td className="sticky left-0 border-b border-border/60 bg-card px-3 py-2 text-right font-data text-xs text-muted-foreground group-hover:bg-muted/40">
                      {rowIndex + 1}
                    </td>
                    {columns.map((column) => {
                      const value = row[column];
                      const numeric = typeof value === "number";
                      return (
                        <td
                          key={column}
                          className={cn(
                            "border-b border-border/60 px-3 py-2 whitespace-nowrap",
                            numeric && "text-right font-data tabular-nums",
                          )}
                        >
                          {formatCellValue(value, column)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function HeaderCell({ column, sort, onSort }: { column: string; sort: "asc" | "desc" | null; onSort: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column });

  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "border-b border-border/60 bg-muted px-3 py-2 text-left font-medium whitespace-nowrap select-none transition-colors duration-150",
        isDragging ? "cursor-grabbing opacity-60" : "cursor-grab",
      )}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "inline-flex items-center gap-1.5 rounded transition-colors duration-150 hover:text-primary",
          sort && "text-primary",
        )}
        aria-label={translate("Sort by {0}", { 0: column })}
      >
        {column}
        {sort === "asc" && <ArrowUp className="h-3 w-3" />}
        {sort === "desc" && <ArrowDown className="h-3 w-3" />}
        {!sort && <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
      </button>
    </th>
  );
}

export function formatRowCount(count: number): string {
  return translate(count === 1 ? "{count} row" : "{count} rows", { count: count.toLocaleString(getLocale()) });
}

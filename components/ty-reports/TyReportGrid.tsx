"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect, useCallback, useRef } from "react";
import { safeInvoke } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnVisibilityPopover } from "@/components/Upload/ColumnVisibilityPopover";
import { TyReportRowModal } from "@/components/ty-reports/TyReportRowModal";
import { TyDeleteRowDialog } from "@/components/ty-reports/TyDeleteRowDialog";
import { TY_PAGE_SIZE, isNumericType, type TyColumn, type TyNotifyTone, type TyRow } from "@/components/ty-reports/types";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Inbox,
  Rows2,
  Rows3,
  Search,
  SearchX,
  X,
} from "lucide-react";

interface PagedRows {
  rows: TyRow[];
  total: number;
  page: number;
  page_size: number;
}

interface TyReportGridProps {
  reportId: number;
  onRowCountChange: () => Promise<void>;
  onNotify: (tone: TyNotifyTone, text: string) => void;
}

type Density = "compact" | "comfortable";
type SortState = { key: string; desc: boolean } | null;

const DENSITY_KEY = "ty-report-density";
const hiddenColsKey = (reportId: number) => `ty-report-hidden-cols-${reportId}`;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable; the choice still applies for this session.
  }
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency: "RON",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

// REAL columns are money. INTEGER columns are often years or codes, so they stay unformatted.
const formatCell = (value: unknown, colType: string): string => {
  if (value == null) return "";
  if (typeof value === "number" && colType === "REAL") return formatCurrency(value);
  return String(value);
};

export function TyReportGrid({ reportId, onRowCountChange, onNotify }: TyReportGridProps) {
  useLanguage();
  const searchRef = useRef<HTMLInputElement>(null);
  const [columns, setColumns] = useState<TyColumn[]>([]);
  const [rows, setRows] = useState<TyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [requestedPage, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<Density>("compact");
  const [sort, setSort] = useState<SortState>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<TyRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<number | null>(null);

  // If a delete empties the last page, show the new last page instead of an empty one.
  const lastPage = Math.max(0, Math.ceil(total / TY_PAGE_SIZE) - 1);
  const page = Math.min(requestedPage, lastPage);

  // Restore view preferences after mount so server and client markup match.
  useEffect(() => {
    setDensity(readStorage<Density>(DENSITY_KEY, "compact"));
    setHiddenCols(new Set(readStorage<string[]>(hiddenColsKey(reportId), [])));
  }, [reportId]);

  // Debounce typing so each keystroke doesn't hit the database.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  // "/" focuses search, the same shortcut the analysis lists use. Skipped while typing or in a dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable='true']")) return;
      if (document.querySelector("[role='dialog']")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const loadColumns = useCallback(async () => {
    try {
      const cols = await safeInvoke<TyColumn[]>("get_ty_report_columns", { reportId });
      setColumns(cols);
    } catch (err) {
      console.error("Failed to load columns:", err);
    }
  }, [reportId]);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await safeInvoke<PagedRows>("get_ty_report_rows", {
        reportId,
        page,
        pageSize: TY_PAGE_SIZE,
        search: query || undefined,
        sortBy: sort?.key,
        sortDesc: sort?.desc ?? false,
      });
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to load rows:", err);
      onNotify("error", translate("Couldn’t load rows."));
    } finally {
      setIsLoading(false);
    }
  }, [reportId, page, query, sort, onNotify]);

  useEffect(() => {
    loadColumns();
  }, [loadColumns]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const visibleColumns = columns.filter((c) => !hiddenCols.has(c.name));
  const totalPages = Math.max(1, Math.ceil(total / TY_PAGE_SIZE));
  const displayStart = total > 0 ? page * TY_PAGE_SIZE + 1 : 0;
  const displayEnd = Math.min((page + 1) * TY_PAGE_SIZE, total);
  const formatCount = (n: number) => n.toLocaleString(getLocale());
  const cellPad = density === "compact" ? "py-1.5" : "py-2.5";

  const openRow = (row: TyRow) => {
    setEditRow(row);
    setModalOpen(true);
  };

  const handleModalSave = async () => {
    setModalOpen(false);
    setEditRow(null);
    await loadRows();
    onNotify("success", translate("Row saved"));
  };

  const handleModalDelete = () => {
    if (editRow) {
      setRowToDelete(editRow._row_id);
    }
    setModalOpen(false);
    setDeleteDialogOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditRow(null);
  };

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false);
    setRowToDelete(null);
    await loadRows();
    await onRowCountChange();
    onNotify("success", translate("Row deleted"));
  };

  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setRowToDelete(null);
  };

  const updateHiddenCols = (next: Set<string>) => {
    setHiddenCols(next);
    writeStorage(hiddenColsKey(reportId), [...next]);
  };

  const toggleCol = (name: string) => {
    const next = new Set(hiddenCols);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    updateHiddenCols(next);
  };

  const changeDensity = (next: Density) => {
    setDensity(next);
    writeStorage(DENSITY_KEY, next);
  };

  // Ascending, then descending, then back to the stored order.
  const toggleSort = (key: string) => {
    setPage(0);
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, desc: false };
      if (!prev.desc) return { key, desc: true };
      return null;
    });
  };

  const clearSearch = () => {
    setSearch("");
    setQuery("");
    setPage(0);
  };

  const renderSortButton = (col: TyColumn, label: string) => {
    const active = sort?.key === col.name;
    return (
      <button
        type="button"
        onClick={() => toggleSort(col.name)}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded px-1 -mx-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
          isNumericType(col.col_type) && "flex-row-reverse"
        )}
      >
        <span className="truncate">{label}</span>
        {active ? (
          sort?.desc ? (
            <ChevronDown className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-primary" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />
        )}
      </button>
    );
  };

  const ariaSort = (col: TyColumn) =>
    sort?.key === col.name ? (sort.desc ? "descending" : "ascending") : "none";

  const isSearching = query.length > 0;
  const showEmpty = !isLoading && rows.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={searchRef}
            type="text"
            aria-label={translate("Search all text columns…")}
            placeholder={translate("Search all text columns…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                clearSearch();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="h-9 pl-9 pr-16 text-sm"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {search ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label={translate("Clear search")}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-data text-[10px] text-muted-foreground">/</kbd>
            )}
          </div>
        </div>

        {isSearching && (
          <span className="font-data text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {isLoading ? translate("Searching…") : translate("{0} results", { 0: formatCount(total) })}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div role="group" aria-label={translate("Row density")} className="flex items-center rounded-md border border-border bg-card p-0.5">
            {([
              { value: "compact", icon: Rows3, label: "Compact rows" },
              { value: "comfortable", icon: Rows2, label: "Comfortable rows" },
            ] as const).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                title={translate(label)}
                aria-label={translate(label)}
                aria-pressed={density === value}
                onClick={() => changeDensity(value)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded transition-colors",
                  density === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <ColumnVisibilityPopover
            columns={columns}
            hiddenCols={hiddenCols}
            onToggle={toggleCol}
            onShowAll={() => updateHiddenCols(new Set())}
            onHideAll={() => updateHiddenCols(new Set(columns.map((c) => c.name)))}
          />
        </div>
      </div>

      {/* Table */}
      <div
        aria-busy={isLoading}
        className={cn("relative min-h-0 flex-1 overflow-auto transition-opacity duration-150", isLoading && rows.length > 0 && "opacity-60")}
      >
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{translate("TY report rows")}</caption>
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 w-12 border-b border-border bg-card px-2 py-2.5 text-right text-xs font-medium text-muted-foreground"
              >
                <span className="sr-only">{translate("Row")}</span>
                #
              </th>
              {visibleColumns.map((col, index) => (
                <th
                  key={col.name}
                  scope="col"
                  aria-sort={ariaSort(col)}
                  className={cn(
                    "border-b border-border bg-card px-3 py-2.5 text-xs font-medium whitespace-nowrap",
                    isNumericType(col.col_type) ? "text-right" : "text-left",
                    index === 0 && "sticky left-12 z-20"
                  )}
                >
                  {renderSortButton(col, col.display_name || col.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && rows.length === 0
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className={cn("border-b border-border/60 px-2", cellPad)}>
                      <div className="ml-auto h-3 w-5 rounded bg-muted" />
                    </td>
                    {visibleColumns.map((col) => (
                      <td key={col.name} className={cn("border-b border-border/60 px-3", cellPad)}>
                        <div className="h-3 w-24 rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, i) => (
                  <tr
                    key={row._row_id}
                    tabIndex={0}
                    onClick={() => openRow(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openRow(row);
                    }}
                    aria-label={translate("Edit row #{0}", { 0: row._row_id })}
                    className="group/row cursor-pointer transition-colors hover:bg-primary/[0.04] focus-visible:bg-primary/[0.06] focus-visible:outline-none"
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-[1] border-b border-border/60 bg-card px-2 text-right font-data text-xs tabular-nums text-muted-foreground group-hover/row:bg-muted/40",
                        cellPad
                      )}
                    >
                      {displayStart + i}
                    </td>
                    {visibleColumns.map((col, index) => {
                      const text = formatCell(row[col.name], col.col_type);
                      const matches = isSearching && text.toLowerCase().includes(query.toLowerCase());
                      return (
                        <td
                          key={col.name}
                          title={text}
                          className={cn(
                            "max-w-56 truncate whitespace-nowrap border-b border-border/60 px-3",
                            cellPad,
                            isNumericType(col.col_type) && "text-right font-data tabular-nums",
                            index === 0 && "sticky left-12 z-[1] bg-card group-hover/row:bg-muted/40"
                          )}
                        >
                          {matches ? (
                            <mark className="rounded bg-primary/15 px-0.5 text-primary">{text}</mark>
                          ) : (
                            text
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>

        {showEmpty && (
          // Outside the table so it stays as wide as the visible area, not the full column set.
          <div className="sticky left-0 w-full">
            <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-12 text-center">
              {isSearching ? (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <SearchX className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">{translate("No matching rows")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("Nothing matches “{0}”.", { 0: query })}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearSearch}>
                    {translate("Clear search")}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Inbox className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">{translate("No data available")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {translate("This report has no rows yet.")}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer: count and pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-2.5">
        <p className="font-data text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {total > 0
            ? translate("{0}-{1} of {2} rows", { 0: formatCount(displayStart), 1: formatCount(displayEnd), 2: formatCount(total) })
            : translate("No rows")}
        </p>
        <nav aria-label={translate("Pagination")} className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            aria-label={translate("Previous page")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i;
              else if (page < 3) pageNum = i;
              else if (page >= totalPages - 3) pageNum = totalPages - 5 + i;
              else pageNum = page - 2 + i;
              const current = page === pageNum;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "font-data h-8 min-w-8 rounded-md px-2 text-xs tabular-nums transition-colors",
                    current
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {pageNum + 1}
                </button>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPage(Math.min(lastPage, page + 1))}
            disabled={page >= totalPages - 1}
            aria-label={translate("Next page")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      </div>

      <TyReportRowModal
        open={modalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        onDelete={handleModalDelete}
        reportId={reportId}
        row={editRow}
        columns={columns}
      />

      <TyDeleteRowDialog
        open={deleteDialogOpen}
        onClose={handleDeleteDialogClose}
        onConfirm={handleDeleteConfirm}
        reportId={reportId}
        rowId={rowToDelete ?? 0}
      />
    </div>
  );
}

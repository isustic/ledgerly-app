"use client";

import { translate, translateMessage, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    SortingState,
    ColumnDef,
    flexRender,
} from "@tanstack/react-table";
import {
    Calendar,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronsLeft,
    ChevronsRight,
    ChevronsUpDown,
    Copy,
    Hash,
    Inbox,
    Rows2,
    Rows3,
    Search,
    SearchX,
    Type,
    X,
} from "lucide-react";
import { ColumnVisibilityPopover } from "@/components/Upload/ColumnVisibilityPopover";

interface ColumnMeta {
    id: number;
    name: string;
    col_type: string;
    display_name?: string;
}

interface PagedRows {
    rows: Record<string, unknown>[];
    total: number;
    page: number;
    page_size: number;
}

type Density = "compact" | "comfortable";

interface DataTableProps {
    datasetId: number;
    datasetName?: string;
    rowCount?: number;
    uploadZone?: React.ReactNode;
}

const PAGE_SIZES = [50, 100, 250] as const;
const DENSITY_KEY = "raw-data-density";
const SEARCH_DEBOUNCE_MS = 300;

const isNumericType = (colType: string) => colType === "INTEGER" || colType === "REAL";

function TypeIcon({ colType }: { colType: string }) {
    useLanguage();
    const Icon = isNumericType(colType) ? Hash : colType === "DATE" ? Calendar : Type;
    return <Icon className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden="true" />;
}

function formatValue(value: unknown, columnName: string) {
    if (value == null || value === "") return null;
    // Keep TVA columns as percentages (checked on the sanitized column name)
    if (columnName.toLowerCase().includes("tva")) {
        const num = typeof value === "number" ? value : parseFloat(String(value));
        if (!isNaN(num)) return `${(num * 100).toFixed(0)}%`;
    }
    return String(value);
}

export function DataTable({ datasetId, uploadZone }: DataTableProps) {
    useLanguage();
    const [columns, setColumns] = useState<ColumnMeta[]>([]);
    const [rowData, setRowData] = useState<Record<string, unknown>[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState<number>(100);
    const [density, setDensity] = useState<Density>("compact");
    const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
    const [query, setQuery] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [jumpValue, setJumpValue] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);
    // Ignore responses from requests that were superseded by a newer one
    const requestIdRef = useRef(0);

    // Restore density preference
    useEffect(() => {
        try {
            const saved = localStorage.getItem(DENSITY_KEY);
            if (saved === "compact" || saved === "comfortable") setDensity(saved);
        } catch {
            // localStorage unavailable; keep default
        }
    }, []);

    const changeDensity = (next: Density) => {
        setDensity(next);
        try {
            localStorage.setItem(DENSITY_KEY, next);
        } catch {
            // ignore
        }
    };

    // Columns for this dataset
    useEffect(() => {
        invoke<ColumnMeta[]>("get_columns", { datasetId })
            .then(setColumns)
            .catch((err) => setError(String(err)));
    }, [datasetId]);

    // Debounce search input and reset to the first page on a new query
    useEffect(() => {
        const timer = setTimeout(() => {
            const next = query.trim();
            setActiveQuery((prev) => {
                if (prev !== next) setPage(0);
                return next;
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query]);

    // Fetch the current page (search or plain)
    useEffect(() => {
        const id = ++requestIdRef.current;
        setIsLoading(true);
        const request = activeQuery
            ? invoke<PagedRows>("search_rows", { datasetId, query: activeQuery, page, pageSize })
            : invoke<PagedRows>("get_rows", { datasetId, page, pageSize });

        request
            .then((res) => {
                if (id !== requestIdRef.current) return;
                setRowData(res.rows);
                setTotal(res.total);
                setError(null);
            })
            .catch((err) => {
                if (id !== requestIdRef.current) return;
                setError(String(err));
            })
            .finally(() => {
                if (id === requestIdRef.current) setIsLoading(false);
            });
    }, [datasetId, page, pageSize, activeQuery]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Keyboard: "/" focuses search, arrow keys change page when not typing
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const typing = target?.matches("input, textarea, select, [contenteditable='true']");
            if (!typing && e.key === "/") {
                e.preventDefault();
                searchRef.current?.focus();
                return;
            }
            if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
            if (e.key === "ArrowRight") setPage((p) => Math.min(totalPages - 1, p + 1));
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [totalPages]);

    const columnTypes = useMemo(() => new Map(columns.map((c) => [c.name, c.col_type])), [columns]);

    const visibleCols: ColumnDef<Record<string, unknown>>[] = columns
        .filter((c) => !hiddenCols.has(c.name))
        .map((c) => ({
            id: c.name,
            accessorKey: c.name,
            header: c.display_name || c.name,
            cell: ({ getValue, row, column }) => {
                const raw = getValue();
                const text = formatValue(raw, c.name);
                const key = `${row.id}:${column.id}`;
                const numeric = isNumericType(c.col_type);
                const matches = activeQuery && text != null && text.toLowerCase().includes(activeQuery.toLowerCase());

                if (text == null) {
                    return <span className={cn("text-muted-foreground/40", numeric && "block text-right")}>—</span>;
                }

                return (
                    <button
                        type="button"
                        title={translate("Click to copy")}
                        onClick={() => {
                            navigator.clipboard?.writeText(text).catch(() => {});
                            setCopiedKey(key);
                            setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
                        }}
                        className={cn(
                            "group/cell flex w-full max-w-64 items-center gap-1.5 rounded px-1 -mx-1 text-left",
                            numeric && "justify-end font-data tabular-nums",
                            "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                    >
                        <span className={cn("truncate", matches && "rounded bg-primary/15 px-0.5 text-primary")}>
                            {text}
                        </span>
                        {copiedKey === key ? (
                            <Check className="h-3 w-3 shrink-0 text-primary" aria-label={translate("Copied")} />
                        ) : (
                            <Copy className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover/cell:text-muted-foreground/60" aria-hidden="true" />
                        )}
                    </button>
                );
            },
        }));

    const table = useReactTable({
        data: rowData,
        columns: visibleCols,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualPagination: true,
        onSortingChange: setSorting,
        state: { sorting },
    });

    const toggleCol = (name: string) =>
        setHiddenCols((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });

    const displayStart = total === 0 ? 0 : page * pageSize + 1;
    const displayEnd = Math.min((page + 1) * pageSize, total);
    const hasQuery = activeQuery.length > 0;
    const sortedCol = sorting[0];

    const goToPage = (n: number) => setPage(Math.min(totalPages - 1, Math.max(0, n)));

    const pageWindow = (() => {
        const count = Math.min(5, totalPages);
        let start = Math.max(0, page - 2);
        start = Math.min(start, totalPages - count);
        return Array.from({ length: count }, (_, i) => start + i);
    })();

    const showSkeleton = isLoading && rowData.length === 0;
    const cellPad = density === "compact" ? "py-1.5" : "py-2.5";

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <div className="relative min-w-[200px] max-w-md flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                        ref={searchRef}
                        type="text"
                        aria-label={translate("Search all columns")}
                        placeholder={translate("Search all columns…")}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setQuery("");
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        className="h-9 pl-9 pr-16 text-sm"
                    />
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                        {query ? (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
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

                <ColumnVisibilityPopover
                    columns={columns}
                    hiddenCols={hiddenCols}
                    onToggle={toggleCol}
                    onShowAll={() => setHiddenCols(new Set())}
                    onHideAll={() => setHiddenCols(new Set(columns.map((c) => c.name)))}
                />

                {/* Density toggle */}
                <div role="group" aria-label={translate("Row density")} className="flex items-center rounded-md border border-border bg-card p-0.5">
                    {([
                        { value: "compact", icon: Rows3, label: translate("Compact rows") },
                        { value: "comfortable", icon: Rows2, label: translate("Comfortable rows") },
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

                {uploadZone && <div className="ml-auto">{uploadZone}</div>}
            </div>

            {/* Active filters */}
            {(hasQuery || hiddenCols.size > 0 || sortedCol) && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-xs">
                    {hasQuery && (
                        <Chip label={`Search: “${activeQuery}”`} onRemove={() => setQuery("")} />
                    )}
                    {hiddenCols.size > 0 && (
                        <Chip
                            label={`${hiddenCols.size} column${hiddenCols.size === 1 ? "" : "s"} hidden`}
                            onRemove={() => setHiddenCols(new Set())}
                        />
                    )}
                    {sortedCol && (
                        <Chip
                            label={`Sorted by ${String(sortedCol.id)} (${sortedCol.desc ? "desc" : "asc"}) · this page`}
                            onRemove={() => setSorting([])}
                        />
                    )}
                </div>
            )}

            {/* Table */}
            <div className="relative min-h-0 flex-1 overflow-auto">
                {error ? (
                    <div className="m-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                        <span className="font-medium">{translate("Couldn’t load rows.")}</span>
                        <span className="text-destructive/80">{translateMessage(error)}</span>
                    </div>
                ) : (
                    <table className="w-full border-separate border-spacing-0 text-sm">
                        <thead>
                            <tr>
                                <th className="sticky left-0 top-0 z-20 w-12 border-b border-border bg-card px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">
                                    #
                                </th>
                                {table.getHeaderGroups().map((hg) =>
                                    hg.headers.map((h) => {
                                        const sortState = h.column.getIsSorted();
                                        const colType = columnTypes.get(h.id) ?? "TEXT";
                                        const numeric = isNumericType(colType);
                                        return (
                                            <th
                                                key={h.id}
                                                aria-sort={sortState === "asc" ? "ascending" : sortState === "desc" ? "descending" : "none"}
                                                className={cn(
                                                    "sticky top-0 z-10 border-b border-border bg-card px-3 py-2.5 text-xs font-medium whitespace-nowrap",
                                                    numeric ? "text-right" : "text-left"
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={h.column.getToggleSortingHandler()}
                                                    disabled={!h.column.getCanSort()}
                                                    title={translate("Sorts the rows on this page")}
                                                    className={cn(
                                                        "group inline-flex items-center gap-1.5 rounded px-1 -mx-1 py-0.5 transition-colors",
                                                        "text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                        sortState && "text-foreground"
                                                    )}
                                                >
                                                    <TypeIcon colType={colType} />
                                                    <span>{flexRender(h.column.columnDef.header, h.getContext())}</span>
                                                    {sortState === "asc" ? (
                                                        <ChevronUp className="h-3.5 w-3.5 text-primary" />
                                                    ) : sortState === "desc" ? (
                                                        <ChevronDown className="h-3.5 w-3.5 text-primary" />
                                                    ) : (
                                                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                                                    )}
                                                </button>
                                            </th>
                                        );
                                    })
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {showSkeleton
                                ? Array.from({ length: 8 }, (_, i) => (
                                      <tr key={`sk-${i}`} className="animate-pulse">
                                          <td className={cn("border-b border-border/60 px-2 text-center", cellPad)}>
                                              <div className="mx-auto h-3 w-6 rounded bg-muted" />
                                          </td>
                                          {table.getAllLeafColumns().slice(0, 6).map((col) => (
                                              <td key={col.id} className={cn("border-b border-border/60 px-3", cellPad)}>
                                                  <div className="h-3 w-24 rounded bg-muted" />
                                              </td>
                                          ))}
                                      </tr>
                                  ))
                                : table.getRowModel().rows.map((row, i) => (
                                      <tr key={row.id} className="group/row transition-colors hover:bg-primary/[0.04]">
                                          <td
                                              className={cn(
                                                  "sticky left-0 z-[1] border-b border-border/60 bg-card px-2 text-center font-data text-xs tabular-nums text-muted-foreground group-hover/row:bg-muted/40",
                                                  cellPad
                                              )}
                                          >
                                              {displayStart + i}
                                          </td>
                                          {row.getVisibleCells().map((cell) => {
                                              const colType = columnTypes.get(cell.column.id) ?? "TEXT";
                                              return (
                                                  <td
                                                      key={cell.id}
                                                      className={cn(
                                                          "border-b border-border/60 px-3 whitespace-nowrap",
                                                          cellPad,
                                                          isNumericType(colType) ? "text-right" : "text-left"
                                                      )}
                                                  >
                                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                  </td>
                                              );
                                          })}
                                      </tr>
                                  ))}
                        </tbody>
                    </table>
                )}

                {/* Empty states */}
                {!error && !isLoading && rowData.length === 0 && (
                    <div className="flex h-80 flex-col items-center justify-center gap-3 px-6 text-center animate-fade-in">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                            {hasQuery ? <SearchX className="h-6 w-6" /> : <Inbox className="h-6 w-6" />}
                        </div>
                        <div>
                            <p className="font-semibold">{hasQuery ? translate("No matching rows") : translate("This dataset is empty")}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {hasQuery ? translate("Nothing matches “{0}”. Try a different word.", { 0: activeQuery }) : translate("There are no rows to show yet.")}
                            </p>
                        </div>
                        {hasQuery && (
                            <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                                {translate("Clear search")}</Button>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-2.5">
                <p className="font-data text-xs text-muted-foreground">
                    {total > 0 ? (
                        <>
                            <span className="text-foreground">{displayStart.toLocaleString(getLocale())}–{displayEnd.toLocaleString(getLocale())}</span>
                            {" "}{translate("of")}{" "}
                            {total.toLocaleString(getLocale())} {hasQuery ? translate("matching rows") : translate("rows")}
                        </>
                    ) : (
                        translate("No rows")
                    )}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={String(pageSize)}
                        onValueChange={(value) => {
                            setPageSize(Number(value));
                            setPage(0);
                        }}
                    >
                        <SelectTrigger size="sm" className="w-40 whitespace-nowrap" aria-label={translate("Rows per page")}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZES.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size} {" "}{translate("per page")}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-0.5">
                        <PageButton label={translate("First page")} onClick={() => goToPage(0)} disabled={page === 0}>
                            <ChevronsLeft className="h-4 w-4" />
                        </PageButton>
                        <PageButton label={translate("Previous page")} onClick={() => goToPage(page - 1)} disabled={page === 0}>
                            <ChevronLeft className="h-4 w-4" />
                        </PageButton>
                        {pageWindow.map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => goToPage(n)}
                                aria-current={page === n ? "page" : undefined}
                                className={cn(
                                    "font-data h-8 min-w-8 rounded-md px-2 text-xs font-medium tabular-nums transition-colors",
                                    page === n
                                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {n + 1}
                            </button>
                        ))}
                        <PageButton label={translate("Next page")} onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1}>
                            <ChevronRight className="h-4 w-4" />
                        </PageButton>
                        <PageButton label={translate("Last page")} onClick={() => goToPage(totalPages - 1)} disabled={page >= totalPages - 1}>
                            <ChevronsRight className="h-4 w-4" />
                        </PageButton>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const n = parseInt(jumpValue, 10);
                            if (!isNaN(n)) goToPage(n - 1);
                            setJumpValue("");
                        }}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                        <span>{translate("Go to")}</span>
                        <Input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={jumpValue}
                            onChange={(e) => setJumpValue(e.target.value)}
                            aria-label={translate("Go to page")}
                            placeholder={String(page + 1)}
                            className="h-8 w-16 px-2 text-center font-data text-xs"
                        />
                    </form>
                </div>
            </div>
        </div>
    );
}

function PageButton({
    label,
    onClick,
    disabled,
    children,
}: {
    label: string;
    onClick: () => void;
    disabled: boolean;
    children: React.ReactNode;
}) {
    useLanguage();
    return (
        <button
            type="button"
            aria-label={translate(label)}
            title={translate(label)}
            onClick={onClick}
            disabled={disabled}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
            {children}
        </button>
    );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
    useLanguage();
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card py-0.5 pl-2.5 pr-1 font-medium">
            {translate(label)}
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${label}`}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
                <X className="h-3 w-3" />
            </button>
        </span>
    );
}

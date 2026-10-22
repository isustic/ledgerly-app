"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    ColumnDef,
    flexRender,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Search, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
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

interface DataTableProps {
    datasetId: number;
    datasetName: string;
    rowCount: number;
    uploadZone?: React.ReactNode;
}

export function DataTable({ datasetId, datasetName, rowCount, uploadZone }: DataTableProps) {
    const [columns, setColumns] = useState<ColumnMeta[]>([]);
    const [rowData, setRowData] = useState<Record<string, unknown>[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
    const [globalSearch, setGlobalSearch] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchTotal, setSearchTotal] = useState(0);
    const [sorting, setSorting] = useState<SortingState>([]);
    const PAGE_SIZE = 100;

    const loadRows = useCallback(async () => {
        const [cols, paged] = await Promise.all([
            invoke<ColumnMeta[]>("get_columns", { datasetId }),
            invoke<PagedRows>("get_rows", {
                datasetId,
                page,
                pageSize: PAGE_SIZE,
            }),
        ]);
        setColumns(cols);
        setRowData(paged.rows);
        setTotal(paged.total);
    }, [datasetId, page]);

    // Initial load
    useEffect(() => {
        loadRows();
    }, [loadRows]);

    // Search effect - debounced
    useEffect(() => {
        if (!globalSearch.trim()) {
            // Reset to normal rows when search is empty
            if (searchTotal > 0) {
                setSearchTotal(0);
                loadRows();
            }
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const paged = await invoke<PagedRows>("search_rows", {
                    datasetId,
                    query: globalSearch,
                    page,
                    pageSize: PAGE_SIZE,
                });
                setRowData(paged.rows);
                setSearchTotal(paged.total);
                // Keep columns in sync
                if (columns.length === 0) {
                    const cols = await invoke<ColumnMeta[]>("get_columns", { datasetId });
                    setColumns(cols);
                }
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [globalSearch, page, datasetId]);

    // When searching, use rowData directly (already filtered by backend)
    const filteredRows = rowData;

    const visibleCols: ColumnDef<Record<string, unknown>>[] = columns
        .filter((c) => !hiddenCols.has(c.name))
        .map((c) => ({
            id: c.name,
            accessorKey: c.name, // Use sanitized name for data access
            header: c.display_name || c.name, // Use original name for display
            cell: ({ getValue, column }) => {
                const v = getValue();
                const headerName = (column.columnDef.header as string) || c.name || c.display_name || "";
                if (v == null) return <span className="text-xs"></span>;

                // Format TVA as percentage (check both sanitized and display name)
                if (headerName.toLowerCase().includes("tva")) {
                    const num = typeof v === "number" ? v : parseFloat(String(v));
                    if (!isNaN(num)) {
                        return <span className="text-xs">{(num * 100).toFixed(0)}%</span>;
                    }
                }

                return <span className="text-xs">{String(v)}</span>;
            },
        }));

    const table = useReactTable({
        data: filteredRows,
        columns: visibleCols,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        manualPagination: true,
        pageCount: Math.ceil(filteredRows.length / PAGE_SIZE),
        onSortingChange: setSorting,
        state: {
            sorting,
        },
    });

    const toggleCol = (name: string) =>
        setHiddenCols((prev) => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });

    const totalPages = Math.ceil(searchTotal > 0 ? searchTotal / PAGE_SIZE : total / PAGE_SIZE);
    const displayStart = page * PAGE_SIZE + 1;
    const displayEnd = Math.min((page + 1) * PAGE_SIZE, searchTotal > 0 ? searchTotal : total);

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Controls bar */}
            <div className="h-12 px-4 flex items-center gap-3 border-b border-border/50 bg-card/20">
                {/* Global search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search all columns..."
                        value={globalSearch}
                        onChange={(e) => { setGlobalSearch(e.target.value); setPage(0); }}
                        className="pl-8 h-8 text-xs bg-background/60 border-border/50 focus-visible:border-primary/50 focus-visible:ring-primary/20"
                    />
                    {globalSearch && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-data">
                            {searchTotal > 0 ? `${searchTotal.toLocaleString()} results` : isSearching ? "Searching..." : ""}
                        </span>
                    )}
                </div>

                <div className="w-px h-5 bg-border/50" />

                {/* Column visibility popover */}
                <ColumnVisibilityPopover
                    columns={columns}
                    hiddenCols={hiddenCols}
                    onToggle={toggleCol}
                    onShowAll={() => setHiddenCols(new Set())}
                    onHideAll={() => setHiddenCols(new Set(columns.map(c => c.name)))}
                />

                {uploadZone && (
                    <>
                        <div className="w-px h-5 bg-border/50" />
                        <div className="ml-auto flex items-center gap-2">
                            {uploadZone}
                        </div>
                    </>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-card/80 border-b border-border/50">
                            <th className="w-8 px-2 py-2 text-center text-[10px] text-muted-foreground font-medium border-r border-border/30">
                                #
                            </th>
                            {table.getHeaderGroups().map((hg) => (
                                hg.headers.map((h) => (
                                    <th
                                        key={h.id}
                                        className={cn(
                                            "text-left px-3 py-2.5 border-r border-border/30 font-medium text-xs whitespace-nowrap last:border-r-0",
                                            h.column.getCanSort() && "cursor-pointer hover:bg-muted/30 select-none transition-colors group"
                                        )}
                                        onClick={h.column.getToggleSortingHandler()}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {flexRender(h.column.columnDef.header, h.getContext())}
                                            <span className="flex items-center">
                                                {h.column.getIsSorted() === "asc" ? (
                                                    <ChevronUp size={12} className="text-primary" />
                                                ) : h.column.getIsSorted() === "desc" ? (
                                                    <ChevronDown size={12} className="text-primary" />
                                                ) : (
                                                    <ChevronsUpDown size={12} className="text-muted-foreground/30 group-hover:text-muted-foreground/60" />
                                                )}
                                            </span>
                                        </div>
                                    </th>
                                ))
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map((row, i) => (
                            <tr
                                key={row.id}
                                className={cn(
                                    "border-b border-border/30 transition-colors hover:bg-primary/5",
                                    i % 2 === 0 ? "bg-background/30" : "bg-background/50"
                                )}
                            >
                                <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground font-data border-r border-border/30">
                                    {displayStart + i}
                                </td>
                                {row.getVisibleCells().map((cell) => (
                                    <td
                                        key={cell.id}
                                        className="px-3 py-2 border-r border-border/30 whitespace-nowrap last:border-r-0 max-w-48 truncate"
                                    >
                                        <span
                                            className={cn(
                                                "font-data",
                                                globalSearch &&
                                                String(cell.getValue() ?? "").toLowerCase().includes(globalSearch.toLowerCase())
                                                    ? "bg-primary/20 text-primary px-1 rounded"
                                                    : ""
                                            )}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </span>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Empty state */}
                {filteredRows.length === 0 && !isSearching && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">
                            {globalSearch ? "No results found" : "No data available"}
                        </p>
                    </div>
                )}

                {isSearching && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
                        <p className="text-sm text-muted-foreground">Searching...</p>
                    </div>
                )}
            </div>

            {/* Pagination */}
            <div className="h-10 px-4 flex items-center justify-between gap-4 border-t border-border/50 bg-card">
                <span className="text-[10px] text-muted-foreground font-data">
                    {filteredRows.length > 0
                        ? `${displayStart.toLocaleString()}-${displayEnd.toLocaleString()} of ${(searchTotal > 0 ? searchTotal : total).toLocaleString()} rows`
                        : "No rows"
                    }
                    {globalSearch && searchTotal > 0 && ` · ${searchTotal.toLocaleString()} results`}
                </span>
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="h-7 w-7 p-0"
                    >
                        <ChevronLeft size={14} />
                    </Button>
                    <div className="flex gap-0.5">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                                pageNum = i;
                            } else if (page < 3) {
                                pageNum = i;
                            } else if (page >= totalPages - 3) {
                                pageNum = totalPages - 5 + i;
                            } else {
                                pageNum = page - 2 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={cn(
                                        "w-7 h-7 rounded text-xs font-medium transition-colors",
                                        page === pageNum
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-muted/60"
                                    )}
                                >
                                    {pageNum + 1}
                                </button>
                            );
                        })}
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="h-7 w-7 p-0"
                    >
                        <ChevronRight size={14} />
                    </Button>
                </div>
            </div>
        </div>
    );
}

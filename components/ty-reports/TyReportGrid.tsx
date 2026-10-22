"use client";

import { useState, useEffect, useCallback } from "react";
import { safeInvoke } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnVisibilityPopover } from "@/components/Upload/ColumnVisibilityPopover";
import { TyReportRowModal } from "@/components/ty-reports/TyReportRowModal";
import { TyDeleteRowDialog } from "@/components/ty-reports/TyDeleteRowDialog";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown, Search } from "lucide-react";

interface TyColumn {
    id: number;
    name: string;
    display_name?: string;
    col_type: string;
    display_order: number;
}

interface TyRow {
    _row_id: number;
    [key: string]: unknown;
}

interface PagedRows {
    rows: TyRow[];
    total: number;
    page: number;
    page_size: number;
}

interface TyReportGridProps {
    reportId: number;
    onRowCountChange: () => Promise<void>;
    onMessage: (msg: string) => void;
}

const PAGE_SIZE = 100;

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ro-RO", {
        style: "currency",
        currency: "RON",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
};

export function TyReportGrid({ reportId, onRowCountChange, onMessage }: TyReportGridProps) {
    const [columns, setColumns] = useState<TyColumn[]>([]);
    const [rows, setRows] = useState<TyRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: string; desc: boolean } | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editRow, setEditRow] = useState<TyRow | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [rowToDelete, setRowToDelete] = useState<number | null>(null);

    const loadColumns = useCallback(async () => {
        try {
            const cols = await safeInvoke<TyColumn[]>("get_ty_report_columns", { reportId });
            setColumns(cols);
        } catch (err) {
            console.error("Failed to load columns:", err);
        }
    }, [reportId]);

    const loadRows = useCallback(async () => {
        setIsSearching(true);
        try {
            const result = await safeInvoke<PagedRows>("get_ty_report_rows", {
                reportId,
                page,
                pageSize: PAGE_SIZE,
                search: search.trim() || undefined,
            });
            setRows(result.rows);
            setTotal(result.total);
        } catch (err) {
            console.error("Failed to load rows:", err);
            onMessage(`Failed to load rows: ${err}`);
        } finally {
            setIsSearching(false);
        }
    }, [reportId, page, search, onMessage]);

    useEffect(() => {
        loadColumns();
    }, [reportId, loadColumns]);

    useEffect(() => {
        loadRows();
    }, [loadRows]);

    // If the current page is beyond the available data (e.g. after deleting the last row on the last page), step back.
    useEffect(() => {
        if (page > 0 && total <= page * PAGE_SIZE) {
            setPage(page - 1);
        }
    }, [page, total]);

    const visibleColumns = columns.filter((c) => !hiddenCols.has(c.name));

    const sortedRows = sortConfig
        ? [...rows].sort((a, b) => {
              const key = sortConfig.key;
              const av = a[key];
              const bv = b[key];
              if (av == null && bv == null) return 0;
              if (av == null) return sortConfig.desc ? 1 : -1;
              if (bv == null) return sortConfig.desc ? -1 : 1;
              if (typeof av === "number" && typeof bv === "number") {
                  return sortConfig.desc ? bv - av : av - bv;
              }
              const as = String(av).toLowerCase();
              const bs = String(bv).toLowerCase();
              if (as === bs) return 0;
              const cmp = as < bs ? -1 : 1;
              return sortConfig.desc ? -cmp : cmp;
          })
        : rows;

    const handleRowClick = (row: TyRow) => {
        setEditRow(row);
        setModalOpen(true);
    };

    const handleModalSave = async () => {
        setModalOpen(false);
        setEditRow(null);
        await loadRows();
        onMessage("Row saved");
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
        onMessage("Row deleted");
    };

    const handleDeleteDialogClose = () => {
        setDeleteDialogOpen(false);
        setRowToDelete(null);
    };

    const toggleCol = (name: string) =>
        setHiddenCols((prev) => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });

    const toggleSort = (key: string) => {
        setSortConfig((prev) => {
            if (!prev || prev.key !== key) return { key, desc: false };
            if (!prev.desc) return { key, desc: true };
            return null;
        });
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const displayStart = total > 0 ? page * PAGE_SIZE + 1 : 0;
    const displayEnd = Math.min((page + 1) * PAGE_SIZE, total);

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Controls */}
            <div className="h-12 px-4 flex items-center gap-3 border-b border-border/50 bg-card/20">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search all text columns…"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(0);
                        }}
                        className="pl-8 h-8 text-xs bg-background/60 border-border/50"
                    />
                    {search && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-data">
                            {isSearching ? "Searching…" : `${total.toLocaleString()} results`}
                        </span>
                    )}
                </div>

                <div className="w-px h-5 bg-border/50" />

                <ColumnVisibilityPopover
                    columns={columns}
                    hiddenCols={hiddenCols}
                    onToggle={toggleCol}
                    onShowAll={() => setHiddenCols(new Set())}
                    onHideAll={() => setHiddenCols(new Set(columns.map((c) => c.name)))}
                />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-card/80 border-b border-border/50">
                            <th className="w-8 px-2 py-2 text-center text-[10px] text-muted-foreground font-medium border-r border-border/30">
                                #
                            </th>
                            {visibleColumns.map((col) => (
                                <th
                                    key={col.name}
                                    onClick={() => toggleSort(col.name)}
                                    className={cn(
                                        "text-left px-3 py-2.5 border-r border-border/30 font-medium text-xs whitespace-nowrap last:border-r-0 cursor-pointer hover:bg-muted/30 select-none transition-colors group"
                                    )}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {col.display_name || col.name}
                                        <span className="flex items-center">
                                            {sortConfig?.key === col.name ? (
                                                sortConfig.desc ? (
                                                    <ChevronDown size={12} className="text-primary" />
                                                ) : (
                                                    <ChevronUp size={12} className="text-primary" />
                                                )
                                            ) : (
                                                <ChevronsUpDown size={12} className="text-muted-foreground/30 group-hover:text-muted-foreground/60" />
                                            )}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRows.map((row, i) => (
                                <tr
                                    key={row._row_id}
                                    onClick={() => handleRowClick(row)}
                                    className={cn(
                                        "border-b border-border/30 transition-colors hover:bg-primary/5 cursor-pointer",
                                        i % 2 === 0 ? "bg-background/30" : "bg-background/50"
                                    )}
                                >
                                    <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground font-data border-r border-border/30">
                                        {displayStart + i}
                                    </td>
                                    {visibleColumns.map((col) => (
                                        <td
                                            key={col.name}
                                            className="px-2 py-1 border-r border-border/30 whitespace-nowrap last:border-r-0 max-w-48 truncate"
                                        >
                                            <span
                                                className={cn(
                                                    "font-data",
                                                    search &&
                                                        String(row[col.name] ?? "")
                                                            .toLowerCase()
                                                            .includes(search.toLowerCase())
                                                        ? "bg-primary/20 text-primary px-1 rounded"
                                                        : ""
                                                )}
                                            >
                                                {row[col.name] == null
                                                    ? ""
                                                    : (col.col_type === "REAL" || col.col_type === "INTEGER") && typeof row[col.name] === "number"
                                                        ? formatCurrency(row[col.name] as number)
                                                        : String(row[col.name])}
                                            </span>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                    </tbody>
                </table>

                {sortedRows.length === 0 && !isSearching && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">
                            {search ? "No results found" : "No data available"}
                        </p>
                    </div>
                )}
            </div>

            {/* Pagination */}
            <div className="h-10 px-4 flex items-center justify-between gap-4 border-t border-border/50 bg-card">
                <span className="text-[10px] text-muted-foreground font-data">
                    {total > 0
                        ? `${displayStart.toLocaleString()}-${displayEnd.toLocaleString()} of ${total.toLocaleString()} rows`
                        : "No rows"}
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

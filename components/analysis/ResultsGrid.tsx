"use client";

import { translate, getLocale, getLanguage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { invoke } from "@tauri-apps/api/core";
import { Download, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface ResultsGridProps {
    data: Record<string, unknown>[];
    columns: string[];
}

type SortDirection = 'asc' | 'desc' | null;

export function ResultsGrid({ data, columns }: ResultsGridProps) {
    useLanguage();
    const [exporting, setExporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ column: string | null; direction: SortDirection }>({
        column: null,
        direction: null
    });

    const PAGE_SIZE = 50;

    // Client-side search and filtering
    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;

        const query = searchQuery.toLowerCase();
        return data.filter((row) =>
            columns.some((col) => {
                const value = row[col];
                return value != null && String(value).toLowerCase().includes(query);
            })
        );
    }, [data, columns, searchQuery]);

    // Sort current page data
    const sortedPageData = useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;
        const pageData = filteredData.slice(startIndex, endIndex);

        if (!sortConfig.column || !sortConfig.direction) {
            return pageData;
        }

        return [...pageData].sort((a, b) => {
            const aVal = a[sortConfig.column!];
            const bVal = b[sortConfig.column!];

            // Handle null/undefined values
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            const aStr = String(aVal);
            const bStr = String(bVal);

            // Try numeric comparison first
            const aNum = parseFloat(aStr);
            const bNum = parseFloat(bStr);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
            }

            // String comparison
            const comparison = aStr.localeCompare(bStr);
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [filteredData, currentPage, sortConfig]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    // Reset to page 1 when search changes
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };

    // Clear search
    const handleClearSearch = () => {
        setSearchQuery("");
        setCurrentPage(1);
    };

    // Column sort handler
    const handleSort = (column: string) => {
        setSortConfig((prev) => {
            if (prev.column === column) {
                // Cycle: asc -> desc -> null
                if (prev.direction === 'asc') {
                    return { column, direction: 'desc' };
                } else if (prev.direction === 'desc') {
                    return { column: null, direction: null };
                }
            }
            // New column or first click
            return { column, direction: 'asc' };
        });
    };

    // Get sort icon for column header
    const getSortIcon = (column: string) => {
        if (sortConfig.column !== column) return null;
        if (sortConfig.direction === 'asc') return <ChevronUp className="w-4 h-4" />;
        if (sortConfig.direction === 'desc') return <ChevronDown className="w-4 h-4" />;
        return null;
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            // Export filtered data if search is active, otherwise all data
            const dataToExport = searchQuery.trim() ? filteredData : data;
            await invoke("export_report", {
        language: getLanguage(),
                rows: dataToExport,
                columns: columns,
            });
        } catch (error) {
            console.error("Export failed:", error);
        } finally {
            setExporting(false);
        }
    };

    if (data.length === 0) {
        return (
            <div className="rounded-xl border border-border/60 bg-card p-8 text-center shadow-sm">
                <p className="text-sm text-muted-foreground">{translate("No results to display")}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{translate("Run your analysis to see results")}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search and Info Bar */}
            <div className="flex items-center gap-4 flex-wrap">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder={translate("Search across all columns...")}
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="h-9 bg-card pl-9 pr-9"
                    />
                    {searchQuery && (
                        <button
                            onClick={handleClearSearch}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Row Count Info */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {searchQuery.trim() ? (
                        <span>
                            <span className="font-medium text-foreground">{filteredData.length.toLocaleString(getLocale())}</span> {" "}{translate("of")}{" "}{data.length.toLocaleString(getLocale())} {" "}{translate("rows match")}</span>
                    ) : (
                        <span>
                            <span className="font-medium text-foreground">{data.length.toLocaleString(getLocale())}</span> {" "}{translate("rows")}</span>
                    )}
                </div>

                {/* Export Button */}
                <Button
                    onClick={handleExport}
                    disabled={exporting}
                    size="sm"
                    variant="outline"
                    className="ml-auto shrink-0"
                >
                    <Download className="w-4 h-4 mr-1" />
                    {translate("Export")}</Button>
            </div>

            {/* Results Table */}
            {sortedPageData.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-card p-8 text-center shadow-sm">
                    <p className="text-sm text-muted-foreground">{translate("No results match your search")}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{translate("Try a different search term")}</p>
                </div>
            ) : (
                <>
                    <div className="overflow-auto rounded-xl border border-border/60 bg-card shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30 sticky top-0">
                                <tr>
                                    {columns.map((col) => (
                                        <th
                                            key={col}
                                            onClick={() => handleSort(col)}
                                            className={cn(
                                                "px-4 py-2.5 text-left font-medium border-b border-border/40 cursor-pointer transition-colors",
                                                "hover:bg-muted/50 select-none",
                                                sortConfig.column === col && "bg-primary/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>{col}</span>
                                                <span className={cn(
                                                    "shrink-0 transition-colors",
                                                    sortConfig.column === col ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-50"
                                                )}>
                                                    {getSortIcon(col)}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPageData.map((row, i) => (
                                    <tr key={i} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                                        {columns.map((col) => (
                                            <td key={col} className="px-4 py-2">
                                                {row[col] != null ? String(row[col]) : ""}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-1">
                            {/* Page Info */}
                            <div className="text-xs text-muted-foreground">
                                {translate("Page")}{" "}<span className="font-medium text-foreground">{currentPage}</span> {" "}{translate("of")}{" "}<span className="font-medium text-foreground">{totalPages}</span>
                                {searchQuery.trim() && (
                                    <span className="ml-2">({filteredData.length.toLocaleString(getLocale())} {" "}{translate("matches)")}</span>
                                )}
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex items-center gap-1">
                                {/* First Page */}
                                <Button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={!hasPrevPage}
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronsLeft className="w-4 h-4" />
                                </Button>

                                {/* Previous Page */}
                                <Button
                                    onClick={() => setCurrentPage((p) => p - 1)}
                                    disabled={!hasPrevPage}
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>

                                {/* Page Numbers */}
                                <div className="flex items-center gap-1 mx-2">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }

                                        return (
                                            <Button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                variant={currentPage === pageNum ? "default" : "ghost"}
                                                size="sm"
                                                className={cn(
                                                    "h-8 w-8 p-0",
                                                    currentPage === pageNum && "bg-primary text-primary-foreground hover:bg-primary/90"
                                                )}
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    })}
                                </div>

                                {/* Next Page */}
                                <Button
                                    onClick={() => setCurrentPage((p) => p + 1)}
                                    disabled={!hasNextPage}
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>

                                {/* Last Page */}
                                <Button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={!hasNextPage}
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronsRight className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Rows per page info */}
                            <div className="text-xs text-muted-foreground">
                                {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredData.length)} {" "}{translate("of")}{" "}{filteredData.length.toLocaleString(getLocale())}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

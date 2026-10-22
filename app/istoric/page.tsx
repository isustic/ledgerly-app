"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRouter } from "next/navigation";
import { History, ChevronDown, ChevronRight, FileSpreadsheet, Calendar, Search, X } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ENGLISH_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

interface Dataset {
    id: number;
    name: string;
    file_origin: string;
    row_count: number;
    created_at: string;
}

export default function IstoricPage() {
    useLanguage();
    const router = useRouter();
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
    const [expandedMonths, setExpandedMonths] = useState<Map<number, Set<number>>>(new Map());

    // Search state
    const [searchQuery, setSearchQuery] = useState("");

    const loadDatasets = useCallback(async () => {
        const ds = await invoke<Dataset[]>("list_datasets");
        setDatasets(ds);
    }, []);

    useEffect(() => {
        loadDatasets();
    }, [loadDatasets]);

    // Filter datasets based on search query
    const filteredDatasets = useMemo(() => {
        if (!searchQuery.trim()) {
            return datasets;
        }

        const query = searchQuery.toLowerCase();
        return datasets.filter(ds => {
            // Search in name
            if (ds.name.toLowerCase().includes(query)) {
                return true;
            }

            // Search in file origin
            if (ds.file_origin.toLowerCase().includes(query)) {
                return true;
            }

            // Search in date (DD-MM-YYYY format)
            const date = new Date(ds.created_at);
            const dateString = `${date.getDate().toString().padStart(2, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getFullYear()}`;
            if (dateString.includes(query)) {
                return true;
            }

            // Search in row count
            if (ds.row_count.toString().includes(query)) {
                return true;
            }

            return false;
        });
    }, [datasets, searchQuery]);

    // Group datasets by year -> month
    const groupedDatasets = useCallback((): Map<number, Map<number, Dataset[]>> => {
        const groups = new Map<number, Map<number, Dataset[]>>();

        for (const ds of filteredDatasets) {
            const date = new Date(ds.created_at);
            const year = date.getFullYear();
            const month = date.getMonth();

            if (!groups.has(year)) {
                groups.set(year, new Map<number, Dataset[]>());
            }
            const yearGroup = groups.get(year)!;
            if (!yearGroup.has(month)) {
                yearGroup.set(month, []);
            }
            yearGroup.get(month)!.push(ds);
        }

        // Sort datasets within each month by created_at (newest first)
        for (const yearGroup of groups.values()) {
            for (const monthDatasets of yearGroup.values()) {
                monthDatasets.sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
            }
        }

        return groups;
    }, [datasets]);

    const groups = groupedDatasets();

    const toggleYear = (year: number) => {
        setExpandedYears(prev => {
            const next = new Set(prev);
            if (next.has(year)) {
                next.delete(year);
            } else {
                next.add(year);
            }
            return next;
        });
    };

    const toggleMonth = (year: number, month: number) => {
        setExpandedMonths(prev => {
            const next = new Map(prev);
            const yearSet = next.get(year) || new Set<number>();
            if (yearSet.has(month)) {
                yearSet.delete(month);
                // Clean up empty year sets
                if (yearSet.size === 0) {
                    next.delete(year);
                } else {
                    next.set(year, yearSet);
                }
            } else {
                yearSet.add(month);
                next.set(year, yearSet);
            }
            return next;
        });
    };

    const openDataset = (dataset: Dataset) => {
        router.push(`/upload?dataset=${dataset.id}`);
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");

        return `${day}-${month}-${year} ${hours}:${minutes}`;
    };

    const sortedYears = Array.from(groups.keys()).sort((a, b) => b - a);

    const clearSearch = () => setSearchQuery("");

    return (
        <div className="flex flex-col h-full bg-background/50 mesh-bg">
            {/* Header */}
            <div className="h-14 px-6 flex items-center gap-3 border-b border-border/50 bg-card">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                    <History className="w-4 h-4 text-primary" />
                </div>
                <div>
                    <h1 className="text-sm font-semibold">{translate("History")}</h1>
                    <p className="text-[10px] text-muted-foreground">
                        {datasets.length} {datasets.length === 1 ? translate("dataset") : translate("datasets")}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {datasets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6">
                        <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-muted/20 to-muted/10 flex items-center justify-center border border-border/50">
                            <Calendar className="w-7 h-7 text-muted-foreground/50" />
                        </div>
                        <h2 className="text-lg font-semibold mb-2 text-foreground">{translate("No data available")}</h2>
                        <p className="text-sm text-muted-foreground">
                            {translate("Import Excel files to view history")}</p>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto p-6">
                        {/* Search Bar */}
                        <div className="mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    type="text"
                                    placeholder={translate("Search by name, date, file path...")}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-10 bg-card/50 border-border/50 focus:border-accent/50 focus:ring-accent/20 transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={clearSearch}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
                                        aria-label={translate("Clear search")}
                                    >
                                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                                    </button>
                                )}
                            </div>
                            {searchQuery && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    {filteredDatasets.length} {filteredDatasets.length === 1 ? translate("result") : translate("results")} {" "}{translate("found")}</p>
                            )}
                        </div>

                        {/* Search Results - show below search bar when searching */}
                        {searchQuery && filteredDatasets.length > 0 ? (
                            <div className="mb-6 space-y-2">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {translate("Search Results")}</h3>
                                    <button
                                        onClick={clearSearch}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        {translate("Clear")}</button>
                                </div>
                                <div className="space-y-1.5">
                                    {filteredDatasets.map((dataset) => (
                                        <button
                                            key={dataset.id}
                                            onClick={() => openDataset(dataset)}
                                            className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background/60 border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                                                    {dataset.name}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground font-data truncate">
                                                    {formatDate(dataset.created_at)} · {dataset.file_origin}
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40 font-data shrink-0">
                                                {dataset.row_count.toLocaleString(getLocale())} {" "}{translate("rows")}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {filteredDatasets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-muted/20 to-muted/10 flex items-center justify-center border border-border/50">
                                    <Search className="w-7 h-7 text-muted-foreground/50" />
                                </div>
                                <h2 className="text-lg font-semibold mb-2 text-foreground">{translate("No results found")}</h2>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {translate("Try adjusting your search query")}</p>
                                <button
                                    onClick={clearSearch}
                                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                    {translate("Clear search")}</button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sortedYears.map((year) => {
                            const yearExpanded = expandedYears.has(year);
                            const yearGroups = groups.get(year)!;
                            const sortedMonths = Array.from(yearGroups.keys()).sort((a, b) => b - a);
                            const yearDatasetCount = Array.from(yearGroups.values())
                                .reduce((sum, arr) => sum + arr.length, 0);

                            return (
                                <Collapsible
                                    key={year}
                                    open={yearExpanded}
                                    onOpenChange={() => toggleYear(year)}
                                >
                                    {/* Year Header */}
                                    <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-card/50 border border-border/50 hover:bg-card/70 transition-colors cursor-pointer">
                                        {yearExpanded ? (
                                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        )}
                                        <span className="text-sm font-semibold">{year}</span>
                                        <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-muted/40">
                                            {yearDatasetCount}
                                        </span>
                                    </CollapsibleTrigger>

                                    {/* Months */}
                                    <CollapsibleContent className="mt-2 ml-6 space-y-2">
                                        {sortedMonths.map((month) => {
                                            const monthExpanded = expandedMonths.get(year)?.has(month);
                                            const monthDatasets = yearGroups.get(month)!;

                                            return (
                                                <Collapsible
                                                    key={month}
                                                    open={monthExpanded}
                                                    onOpenChange={() => toggleMonth(year, month)}
                                                >
                                                    {/* Month Header */}
                                                    <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors cursor-pointer">
                                                        {monthExpanded ? (
                                                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                                        )}
                                                        <span className="text-xs font-medium">{translate(ENGLISH_MONTHS[month])}</span>
                                                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-background/60">
                                                            {monthDatasets.length}
                                                        </span>
                                                    </CollapsibleTrigger>

                                                    {/* Datasets */}
                                                    <CollapsibleContent className="mt-1.5 ml-5 space-y-1.5">
                                                        {monthDatasets.map((dataset) => (
                                                            <button
                                                                key={dataset.id}
                                                                onClick={() => openDataset(dataset)}
                                                                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background/60 border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
                                                            >
                                                                <FileSpreadsheet className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                                                                        {dataset.name}
                                                                    </p>
                                                                    <p className="text-[10px] text-muted-foreground font-data truncate">
                                                                        {formatDate(dataset.created_at)} · {dataset.file_origin}
                                                                    </p>
                                                                </div>
                                                                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40 font-data shrink-0">
                                                                    {dataset.row_count.toLocaleString(getLocale())} {" "}{translate("rows")}</span>
                                                            </button>
                                                        ))}
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            );
                                        })}
                                    </CollapsibleContent>
                                </Collapsible>
                            );
                        })}
                    </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Input } from "@/components/ui/input";
import { FileSpreadsheet, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TyReport } from "@/components/ty-reports/types";

interface ReportListProps {
  reports: TyReport[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  loading: boolean;
}

// Searching only earns its place once there are enough reports to scroll past.
const SEARCH_THRESHOLD = 6;

export function ReportList({
  reports,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  loading,
}: ReportListProps) {
  useLanguage();
  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? reports.filter((r) => r.name.toLowerCase().includes(query) || r.original_file_name.toLowerCase().includes(query))
    : reports;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {translate("Reports")}
          </p>
          <span className="font-data rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {reports.length}
          </span>
        </div>

        {reports.length >= SEARCH_THRESHOLD && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              aria-label={translate("Search reports")}
              placeholder={translate("Search reports…")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onSearchChange("");
              }}
              className="h-9 pl-9 pr-8 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label={translate("Clear search")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && reports.length === 0 ? (
          <div className="space-y-2 p-1" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            {reports.length === 0 ? (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold">{translate("No TY reports yet")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {translate("Upload an Excel file to get started")}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{translate("No reports match your search.")}</p>
            )}
          </div>
        ) : (
          <ul role="listbox" aria-label={translate("Reports")} className="space-y-0.5">
            {filtered.map((report) => {
              const selected = report.id === selectedId;
              return (
                <li key={report.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onSelect(report.id)}
                    className={cn(
                      "relative flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                      selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                    )}
                  >
                    {selected && (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", selected ? "font-semibold" : "font-medium")}>
                        {report.name}
                      </span>
                      <span className="font-data shrink-0 text-xs tabular-nums text-muted-foreground">
                        {report.row_count.toLocaleString(getLocale())}
                      </span>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">{report.original_file_name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

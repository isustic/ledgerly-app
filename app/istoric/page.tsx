"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { History, FileSpreadsheet, Upload, Search, X, ArrowRight, Calendar, RotateCcw } from "lucide-react";
import { translate, translateMessage, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { safeInvoke } from "@/lib/tauri";
import { setLastOpenedDataset } from "@/lib/dataset-tracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ENGLISH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Same threshold as the report sidebar: search only pays off with a longer list.
const SEARCH_THRESHOLD = 6;

interface Dataset {
  id: number;
  name: string;
  file_origin: string;
  row_count: number;
  created_at: string;
}

type Tone = "sky" | "emerald" | "violet" | "amber";

const TONE_DOT: Record<Tone, string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
};

const parseDate = (value: string) => new Date(value.replace(" ", "T"));

const formatDate = (value: string) => {
  const date = parseDate(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(getLocale(), { day: "numeric", month: "short", year: "numeric" });
};

// Matches the DD-MM-YYYY date format users see in the list.
const toSearchDate = (value: string) => {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
};

export default function IstoricPage() {
  useLanguage();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    safeInvoke<Dataset[]>("list_datasets")
      .then((list) => {
        if (cancelled) return;
        setDatasets(list);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(translateMessage(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retryLoad = () => {
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  const filteredDatasets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return datasets;

    return datasets.filter((ds) =>
      ds.name.toLowerCase().includes(query) ||
      ds.file_origin.toLowerCase().includes(query) ||
      toSearchDate(ds.created_at).includes(query) ||
      ds.row_count.toString().includes(query)
    );
  }, [datasets, searchQuery]);

  // Year -> month -> datasets, newest first at every level.
  const groups = useMemo(() => {
    const result = new Map<number, Map<number, Dataset[]>>();

    for (const ds of filteredDatasets) {
      const date = parseDate(ds.created_at);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!result.has(year)) result.set(year, new Map());
      const yearGroup = result.get(year)!;
      if (!yearGroup.has(month)) yearGroup.set(month, []);
      yearGroup.get(month)!.push(ds);
    }

    for (const yearGroup of result.values()) {
      for (const monthDatasets of yearGroup.values()) {
        monthDatasets.sort((a, b) => parseDate(b.created_at).getTime() - parseDate(a.created_at).getTime());
      }
    }

    return result;
  }, [filteredDatasets]);

  const sortedYears = useMemo(() => Array.from(groups.keys()).sort((a, b) => b - a), [groups]);

  const stats = useMemo(() => {
    const totalRows = datasets.reduce((sum, ds) => sum + ds.row_count, 0);
    const times = datasets
      .map((ds) => parseDate(ds.created_at).getTime())
      .filter((time) => !Number.isNaN(time));
    const latest = times.length ? new Date(Math.max(...times)).toISOString() : null;
    const years = new Set(times.map((time) => new Date(time).getFullYear())).size;
    return { totalRows, latest, years };
  }, [datasets]);

  const kpis: Array<{ label: string; value: string; tone: Tone }> = [
    { label: translate("Datasets"), value: datasets.length.toLocaleString(getLocale()), tone: "sky" },
    { label: translate("Total rows"), value: stats.totalRows.toLocaleString(getLocale()), tone: "emerald" },
    { label: translate("Last activity"), value: stats.latest ? formatDate(stats.latest) : "—", tone: "amber" },
    { label: translate("Years covered"), value: stats.years.toLocaleString(getLocale()), tone: "violet" },
  ];

  const openDataset = (dataset: Dataset) => {
    setLastOpenedDataset(dataset.id);
    router.push(`/upload?dataset=${dataset.id}`);
  };

  const clearSearch = () => setSearchQuery("");

  const renderBody = () => {
    if (loading) {
      return (
        <div aria-busy="true" aria-label={translate("Loading")} className="space-y-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-lg border border-border bg-muted/50" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-muted/60" />
        </div>
      );
    }

    if (datasets.length === 0) {
      return (
        <div className="flex justify-center">
          <div className="flex max-w-md animate-fade-in flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{translate("No data available")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{translate("Import Excel files to view history")}</p>
            </div>
            <Button className="gap-2" onClick={() => router.push("/upload")}>
              <Upload className="h-4 w-4" />
              {translate("Import Excel")}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="border-border/60 bg-card">
              <CardContent className="min-w-0 space-y-1 p-3 xl:p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[kpi.tone])} aria-hidden="true" />
                  <span className="truncate">{kpi.label}</span>
                </div>
                <p className="truncate text-sm font-semibold tabular-nums xl:text-base" title={kpi.value}>
                  {kpi.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {datasets.length >= SEARCH_THRESHOLD && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={translate("Search by name, date, file path...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") clearSearch();
              }}
              className="h-9 pl-9 pr-8 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={translate("Clear search")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {filteredDatasets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{translate("No results found")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{translate("Try adjusting your search query")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={clearSearch}>
              {translate("Clear search")}
            </Button>
          </div>
        ) : (
          sortedYears.map((year) => {
            const yearGroups = groups.get(year)!;
            const sortedMonths = Array.from(yearGroups.keys()).sort((a, b) => b - a);
            const yearCount = Array.from(yearGroups.values()).reduce((sum, list) => sum + list.length, 0);

            return (
              <section key={year} aria-labelledby={`year-${year}`} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 id={`year-${year}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {year}
                  </h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-data text-xs tabular-nums text-muted-foreground">
                    {yearCount}
                  </span>
                </div>

                <Card className="overflow-hidden border-border/60 bg-card">
                  <CardContent className="p-0">
                    {sortedMonths.map((month, index) => (
                      <div key={month} className={cn(index > 0 && "border-t border-border")}>
                        <div className="bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                          {translate(ENGLISH_MONTHS[month])}
                        </div>
                        <ul className="divide-y divide-border">
                          {yearGroups.get(month)!.map((dataset) => (
                            <li key={dataset.id}>
                              <button
                                type="button"
                                onClick={() => openDataset(dataset)}
                                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                              >
                                <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{dataset.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">{dataset.file_origin}</p>
                                </div>
                                <span className="hidden font-data text-xs tabular-nums text-muted-foreground sm:block">
                                  {dataset.row_count.toLocaleString(getLocale())} {translate("Rows")}
                                </span>
                                <span className="hidden w-28 text-right text-xs text-muted-foreground md:block">
                                  {formatDate(dataset.created_at)}
                                </span>
                                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>
            );
          })
        )}
      </>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">{translate("History")}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {datasets.length} {datasets.length === 1 ? translate("dataset") : translate("datasets")}
            </p>
          </div>
        </div>
        {datasets.length > 0 && (
          <Button variant="outline" className="h-9 gap-2" onClick={() => router.push("/upload")}>
            <Upload className="h-4 w-4 text-primary" />
            {translate("Import Excel")}
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
          {error && (
            <Alert variant="destructive" className="py-2.5">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{error}</span>
                <Button variant="outline" size="sm" className="bg-background" onClick={retryLoad}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  {translate("Try again")}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {renderBody()}
        </div>
      </div>
    </div>
  );
}

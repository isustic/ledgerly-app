"use client";

import { translate, getLocale, getLanguage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  SortingState,
  VisibilityState,
  ColumnDef,
  flexRender,
  Row,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Inbox,
  Loader2,
  Rows2,
  Rows3,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProgramBadge } from "./ProgramBadge";
import { invoke } from "@tauri-apps/api/core";
import { QUALIFIED_MIN_TOTAL } from "@/lib/epp";

export interface EppRow {
  client: string;
  agent: string;
  q1_total: number;
  q2_total: number;
  q3_total: number;
  q4_total: number;
  total_anual: number;
  reducere: number;
  total: number;
  program: string;
  procent: string;
  total_2025: number;
  vs_2025_2026: number;
  bonus_crestere: number;
  culoare_decolorare_q1: number;
  culoare_decolorare_q2: number;
  culoare_decolorare_q3: number;
  culoare_decolorare_q4: number;
  haircare_tehnic_q1: number;
  haircare_tehnic_q2: number;
  haircare_tehnic_q3: number;
  haircare_tehnic_q4: number;
  suma_bonus: number;
  suma_bonus_reducere: number;
  total_bonus: number;
  suma_voucher: number;
  is_combined: boolean;
  source_clients: string[];
}

interface EppReportTableProps {
  /** Rows after the page's client search and qualified filter. */
  rows: EppRow[];
  /** Every row for the agent, before filtering. Used for the footer count. */
  totalRowCount: number;
  agentName: string;
  year: number;
  query: string;
  onQueryChange: (value: string) => void;
  showQualifiedOnly: boolean;
  onQualifiedFilterChange: (value: boolean) => void;
}

type GroupId = "core" | "quarterly" | "comparison" | "culoare" | "tehnic" | "bonus";

const COLUMN_GROUP: Record<string, GroupId> = {
  client: "core",
  agent: "core",
  total_anual: "core",
  reducere: "core",
  total: "core",
  program: "core",
  procent: "core",
  q1_total: "quarterly",
  q2_total: "quarterly",
  q3_total: "quarterly",
  q4_total: "quarterly",
  total_2025: "comparison",
  vs_2025_2026: "comparison",
  bonus_crestere: "comparison",
  culoare_decolorare_q1: "culoare",
  culoare_decolorare_q2: "culoare",
  culoare_decolorare_q3: "culoare",
  culoare_decolorare_q4: "culoare",
  haircare_tehnic_q1: "tehnic",
  haircare_tehnic_q2: "tehnic",
  haircare_tehnic_q3: "tehnic",
  haircare_tehnic_q4: "tehnic",
  suma_bonus: "bonus",
  suma_bonus_reducere: "bonus",
  total_bonus: "bonus",
  suma_voucher: "bonus",
};

/** Optional column groups the user can show or hide. Core columns are always visible. */
const TOGGLE_GROUPS: GroupId[] = ["quarterly", "comparison", "culoare", "tehnic", "bonus"];
const DEFAULT_VISIBLE_GROUPS: GroupId[] = ["quarterly", "bonus"];

const GROUP_LABEL: Record<GroupId, string> = {
  core: "",
  quarterly: "Quarterly totals",
  comparison: "Year comparison",
  culoare: "Culoare + Decolorare",
  tehnic: "Haircare tehnic",
  bonus: "Bonus",
};

const NUMERIC_IDS = new Set([
  "q1_total", "q2_total", "q3_total", "q4_total", "total_anual", "reducere", "total",
  "total_2025", "vs_2025_2026", "bonus_crestere", "culoare_decolorare_q1", "culoare_decolorare_q2",
  "culoare_decolorare_q3", "culoare_decolorare_q4", "haircare_tehnic_q1", "haircare_tehnic_q2",
  "haircare_tehnic_q3", "haircare_tehnic_q4", "suma_bonus", "suma_bonus_reducere", "total_bonus", "suma_voucher",
]);

const GROUPS_KEY = "epp-column-groups";
const DENSITY_KEY = "epp-density";
type Density = "compact" | "comfortable";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency: "RON",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatPercent = (value: number) => `${value.toFixed(0)}%`;

export function EppReportTable({
  rows,
  totalRowCount,
  agentName,
  year,
  query,
  onQueryChange,
  showQualifiedOnly,
  onQualifiedFilterChange,
}: EppReportTableProps) {
  const language = useLanguage();
  const [sorting, setSorting] = useState<SortingState>([{ id: "client", desc: false }]);
  const [visibleGroups, setVisibleGroups] = useState<GroupId[]>(DEFAULT_VISIBLE_GROUPS);
  const [density, setDensity] = useState<Density>("compact");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Restore saved view preferences.
  useEffect(() => {
    try {
      const savedGroups = localStorage.getItem(GROUPS_KEY);
      if (savedGroups) setVisibleGroups(JSON.parse(savedGroups) as GroupId[]);
      const savedDensity = localStorage.getItem(DENSITY_KEY);
      if (savedDensity === "compact" || savedDensity === "comfortable") setDensity(savedDensity);
    } catch {
      // Storage unavailable; keep defaults.
    }
  }, []);

  const toggleGroup = (group: GroupId) => {
    setVisibleGroups((current) => {
      const next = current.includes(group) ? current.filter((g) => g !== group) : [...current, group];
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable; the choice still applies for this session.
      }
      return next;
    });
  };

  const changeDensity = (next: Density) => {
    setDensity(next);
    try {
      localStorage.setItem(DENSITY_KEY, next);
    } catch {
      // Storage unavailable; the choice still applies for this session.
    }
  };

  const columnVisibility: VisibilityState = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(COLUMN_GROUP).map(([id, group]) => [
          id,
          group === "core" || visibleGroups.includes(group),
        ])
      ),
    [visibleGroups]
  );

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      // Export always includes every column, regardless of which groups are shown on screen.
      const exportRows = rows.map((row) => ({
        Client: row.client,
        Agent: row.agent,
        "Total Q1": row.q1_total,
        "Total Q2": row.q2_total,
        "Total Q3": row.q3_total,
        "Total Q4": row.q4_total,
        "Total Anual": row.total_anual,
        "Total 7.5%": row.reducere,
        "Total incadrare": row.total,
        "Program incadrare": row.program,
        "Procent incadrare": row.procent,
        "Total 2025": row.total_2025,
        "2025 vs 2026": row.vs_2025_2026,
        "Bonus crestere": row.bonus_crestere,
        "Culoare + Decolorare Q1": row.culoare_decolorare_q1,
        "Culoare + Decolorare Q2": row.culoare_decolorare_q2,
        "Culoare + Decolorare Q3": row.culoare_decolorare_q3,
        "Culoare + Decolorare Q4": row.culoare_decolorare_q4,
        "Tehnic Q1": row.haircare_tehnic_q1,
        "Tehnic Q2": row.haircare_tehnic_q2,
        "Tehnic Q3": row.haircare_tehnic_q3,
        "Tehnic Q4": row.haircare_tehnic_q4,
        "Suma bonus": row.suma_bonus,
        "Suma calcul bonus - 7.5%": row.suma_bonus_reducere,
        "Total bonus": row.total_bonus,
        "Suma voucher": row.suma_voucher,
      }));

      const columnKeys = [
        "Client", "Agent", "Total Q1", "Total Q2", "Total Q3", "Total Q4", "Total Anual", "Total 7.5%",
        "Total incadrare", "Program incadrare", "Procent incadrare", "Total 2025", "2025 vs 2026",
        "Bonus crestere", "Culoare + Decolorare Q1", "Culoare + Decolorare Q2", "Culoare + Decolorare Q3",
        "Culoare + Decolorare Q4", "Tehnic Q1", "Tehnic Q2", "Tehnic Q3", "Tehnic Q4", "Suma bonus",
        "Suma calcul bonus - 7.5%", "Total bonus", "Suma voucher",
      ];

      await invoke("export_report", {
        language: getLanguage(),
        rows: exportRows.map((row) =>
          Object.fromEntries(Object.entries(row).map(([key, value]) => [translate(key), value]))
        ),
        columns: columnKeys.map((key) => translate(key)),
        templateName: translate("EPro Report - {0} - {1}", { 0: agentName, 1: year }),
      });
    } catch (err) {
      console.error("Export failed:", err);
      setExportError(translate("Export failed. Please try again."));
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<ColumnDef<EppRow>[]>(() => {
    const money = (id: keyof EppRow, header: string, className?: string): ColumnDef<EppRow> => ({
      id,
      accessorKey: id,
      header,
      cell: ({ getValue }) => (
        <span className={cn("font-data tabular-nums", className)}>{formatCurrency(getValue() as number)}</span>
      ),
    });
    const percent = (id: keyof EppRow, header: string, className?: string): ColumnDef<EppRow> => ({
      id,
      accessorKey: id,
      header,
      cell: ({ getValue }) => (
        <span className={cn("font-data tabular-nums", className)}>{formatPercent(getValue() as number)}</span>
      ),
    });

    return [
      {
        id: "client",
        accessorKey: "client",
        header: translate("Client", {}, language),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            {row.original.is_combined && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  row.toggleExpanded();
                }}
                aria-expanded={row.getIsExpanded()}
                aria-label={translate("Show source clients")}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", row.getIsExpanded() && "rotate-90")} />
              </button>
            )}
            <span className="whitespace-nowrap font-medium">{row.original.client}</span>
          </div>
        ),
      },
      {
        id: "agent",
        accessorKey: "agent",
        header: translate("Agent", {}, language),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-muted-foreground">{getValue() as string}</span>
        ),
      },
      money("total_anual", translate("Total Anual", {}, language), "font-semibold"),
      money("reducere", translate("Reducere 7.5%", {}, language), "text-muted-foreground"),
      money("total", translate("Total", {}, language), "font-semibold text-primary"),
      {
        id: "program",
        accessorKey: "program",
        header: translate("Program incadrare", {}, language),
        cell: ({ row }) => <ProgramBadge program={row.original.program} />,
      },
      {
        id: "procent",
        accessorKey: "procent",
        header: translate("Procent", {}, language),
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return (
            <span className={cn("font-data tabular-nums", value === "-" ? "text-muted-foreground" : "text-primary")}>
              {value}
            </span>
          );
        },
      },
      money("q1_total", translate("Total Q1", {}, language)),
      money("q2_total", translate("Total Q2", {}, language)),
      money("q3_total", translate("Total Q3", {}, language)),
      money("q4_total", translate("Total Q4", {}, language)),
      // The backend always compares against the TY 2025 totals, so these labels are fixed, not year-driven.
      money("total_2025", translate("Total 2025", {}, language)),
      money("vs_2025_2026", translate("2025 vs 2026", {}, language), "text-muted-foreground"),
      percent("bonus_crestere", translate("Bonus crestere", {}, language), "font-semibold text-success"),
      money("culoare_decolorare_q1", translate("Culoare + Decolorare Q1", {}, language)),
      money("culoare_decolorare_q2", translate("Culoare + Decolorare Q2", {}, language)),
      money("culoare_decolorare_q3", translate("Culoare + Decolorare Q3", {}, language)),
      money("culoare_decolorare_q4", translate("Culoare + Decolorare Q4", {}, language)),
      money("haircare_tehnic_q1", translate("Tehnic Q1", {}, language)),
      money("haircare_tehnic_q2", translate("Tehnic Q2", {}, language)),
      money("haircare_tehnic_q3", translate("Tehnic Q3", {}, language)),
      money("haircare_tehnic_q4", translate("Tehnic Q4", {}, language)),
      money("suma_bonus", translate("Suma bonus", {}, language), "font-semibold"),
      money("suma_bonus_reducere", translate("Suma calcul bonus - 7.5%", {}, language), "font-semibold"),
      percent("total_bonus", translate("Total bonus", {}, language), "font-semibold text-success"),
      money("suma_voucher", translate("Suma voucher", {}, language), "font-semibold"),
    ];
  }, [language]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row: Row<EppRow>) => row.original.is_combined,
    onSortingChange: setSorting,
    state: { sorting, columnVisibility },
  });

  const leafColumns = table.getVisibleLeafColumns();
  const hasFilters = query.trim().length > 0 || showQualifiedOnly;
  const cellPad = density === "compact" ? "py-1.5" : "py-2.5";

  // Group header row: consecutive columns of the same group share one labelled cell.
  // Core columns span both header rows instead.
  const groupRuns: { group: GroupId; columns: typeof leafColumns }[] = [];
  for (const column of leafColumns) {
    const group = COLUMN_GROUP[column.id];
    const last = groupRuns[groupRuns.length - 1];
    if (last && last.group === group) last.columns.push(column);
    else groupRuns.push({ group, columns: [column] });
  }

  const sortLabel = (sorted: false | "asc" | "desc") =>
    sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";

  const renderSortButton = (column: (typeof leafColumns)[number], label: string) => {
    const sorted = column.getIsSorted();
    return (
      <button
        type="button"
        onClick={column.getToggleSortingHandler()}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded px-1 -mx-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          sorted && "text-foreground",
          NUMERIC_IDS.has(column.id) && "flex-row-reverse"
        )}
      >
        <span>{label}</span>
        {sorted === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5 text-primary" />
        ) : sorted === "desc" ? (
          <ChevronDown className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />
        )}
      </button>
    );
  };

  const headerLabel = (column: (typeof leafColumns)[number]) => String(column.columnDef.header ?? "");

  const emptyState = (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-12 text-center">
      {totalRowCount === 0 ? (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Inbox className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold">{translate("No clients for this agent")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{translate("Try a different year or agent.")}</p>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <SearchX className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold">{translate("No matching clients")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{translate("Nothing matches your current filters.")}</p>
          </div>
          {hasFilters && (
            <div className="flex items-center gap-2">
              {query.trim() && (
                <Button variant="outline" size="sm" onClick={() => onQueryChange("")}>
                  {translate("Clear search")}
                </Button>
              )}
              {showQualifiedOnly && (
                <Button variant="outline" size="sm" onClick={() => onQualifiedFilterChange(false)}>
                  {translate("Show all clients")}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              aria-label={translate("Search clients")}
              placeholder={translate("Search clients...")}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onQueryChange("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="h-9 pl-9 pr-16 text-sm"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              {query ? (
                <button
                  type="button"
                  onClick={() => onQueryChange("")}
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

          <button
            type="button"
            aria-pressed={showQualifiedOnly}
            onClick={() => onQualifiedFilterChange(!showQualifiedOnly)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
              showQualifiedOnly
                ? "border-primary/40 bg-accent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {translate("Qualified only")}
            <span className="font-data text-xs opacity-70">≥{QUALIFIED_MIN_TOTAL.toLocaleString(getLocale())}</span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            {/* Density toggle */}
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

            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting || rows.length === 0}
              className="h-9 gap-2"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {translate("Export Excel")}
            </Button>
          </div>
        </div>

        {/* Column groups */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{translate("Columns")}</span>
          <div role="group" aria-label={translate("Column groups")} className="flex flex-wrap items-center gap-1.5">
            {TOGGLE_GROUPS.map((group) => {
              const on = visibleGroups.includes(group);
              return (
                <button
                  key={group}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleGroup(group)}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
                    on
                      ? "border-primary/40 bg-accent text-accent-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {translate(GROUP_LABEL[group])}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {exportError && (
        <div role="alert" className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {exportError}
        </div>
      )}

      {/* Table */}
      <div className="relative h-[clamp(16rem,calc(100vh_-_22rem),56rem)] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10">
            {/* Group row */}
            <tr>
              {groupRuns.map((run, i) =>
                run.group === "core" ? (
                  run.columns.map((column) => (
                    <th
                      key={column.id}
                      rowSpan={2}
                      aria-sort={sortLabel(column.getIsSorted())}
                      className={cn(
                        "border-b border-border bg-card px-3 py-2.5 text-left align-bottom text-xs font-medium whitespace-nowrap",
                        column.id === "client" && "sticky left-0 z-20"
                      )}
                    >
                      {column.getCanSort() ? renderSortButton(column, headerLabel(column)) : headerLabel(column)}
                    </th>
                  ))
                ) : (
                  <th
                    key={`${run.group}-${i}`}
                    colSpan={run.columns.length}
                    className="border-b border-border/60 bg-muted/40 px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                  >
                    {translate(GROUP_LABEL[run.group])}
                  </th>
                )
              )}
            </tr>
            {/* Column row (non-core columns only) */}
            <tr>
              {groupRuns.flatMap((run) =>
                run.group === "core"
                  ? []
                  : run.columns.map((column) => (
                      <th
                        key={column.id}
                        aria-sort={sortLabel(column.getIsSorted())}
                        className={cn(
                          "border-b border-border bg-card px-3 py-2.5 text-xs font-medium whitespace-nowrap",
                          NUMERIC_IDS.has(column.id) ? "text-right" : "text-left"
                        )}
                      >
                        {column.getCanSort() ? renderSortButton(column, headerLabel(column)) : headerLabel(column)}
                      </th>
                    ))
              )}
            </tr>
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  className={cn(
                    "group/row transition-colors hover:bg-primary/[0.04]",
                    row.original.is_combined && "bg-primary/[0.02]"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "whitespace-nowrap border-b border-border/60 px-3",
                        cellPad,
                        NUMERIC_IDS.has(cell.column.id) && "text-right",
                        cell.column.id === "client" && "sticky left-0 z-[1] bg-card group-hover/row:bg-muted/40"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr className="bg-muted/30">
                    <td
                      colSpan={leafColumns.length}
                      className="border-b border-border/60 px-6 py-2 text-xs text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">{translate("Source clients:")}</span>{" "}
                      {row.original.source_clients.join(", ")}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          // Outside the table so it stays as wide as the visible area, not the 26-column table.
          <div className="sticky left-0 w-full">{emptyState}</div>
        )}

      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
        <p className="font-data tabular-nums" aria-live="polite">
          {translate("{shown} of {total} clients", { shown: rows.length, total: totalRowCount })}
        </p>
      </div>
    </div>
  );
}

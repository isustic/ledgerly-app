"use client";

import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  SortingState,
  ColumnDef,
  flexRender,
  Row,
} from "@tanstack/react-table";
import { ChevronsUpDown, ChevronUp, ChevronDown, Download, Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProgramBadge } from "./ProgramBadge";
import { invoke } from "@tauri-apps/api/core";

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
  rows: EppRow[];
  agentName: string;
  year: number;
  showQualifiedOnly: boolean;
  onQualifiedFilterChange: (value: boolean) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export function EppReportTable({ rows, agentName, year, showQualifiedOnly, onQualifiedFilterChange }: EppReportTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "client", desc: false }]);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter rows by search query and qualified filter
  const filteredRows = useMemo(() => {
    let result = rows;

    // Filter by qualified status (Total >= 18000 AND has a program)
    if (showQualifiedOnly) {
      result = result.filter((row) =>
        row.total >= 18000 && row.program !== "-" && row.program !== ""
      );
    }

    // Filter by search query (searches client name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) =>
        row.client.toLowerCase().includes(query)
      );
    }

    return result;
  }, [rows, searchQuery, showQualifiedOnly]);

  const handleExport = async () => {
    try {
      // Convert filtered rows to the format expected by export_report
      const exportRows = filteredRows.map((row) => ({
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

      const columns = [
        "Client",
        "Agent",
        "Total Q1",
        "Total Q2",
        "Total Q3",
        "Total Q4",
        "Total Anual",
        "Total 7.5%",
        "Total incadrare",
        "Program incadrare",
        "Procent incadrare",
        "Total 2025",
        "2025 vs 2026",
        "Bonus crestere",
        "Culoare + Decolorare Q1",
        "Culoare + Decolorare Q2",
        "Culoare + Decolorare Q3",
        "Culoare + Decolorare Q4",
        "Tehnic Q1",
        "Tehnic Q2",
        "Tehnic Q3",
        "Tehnic Q4",
        "Suma bonus",
        "Suma calcul bonus - 7.5%",
        "Total bonus",
        "Suma voucher",
      ];

      await invoke("export_report", {
        rows: exportRows,
        columns,
        templateName: `EPro Report - ${agentName} - ${year}`,
      });
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const columns = useMemo<ColumnDef<EppRow>[]>(
    () => [
      {
        id: "client",
        accessorKey: "client",
        header: "Client",
        cell: ({ row }) => {
          if (row.original.is_combined) {
            return (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    row.toggleExpanded();
                  }}
                  className="p-0.5 rounded hover:bg-muted/50 transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn(
                      "transition-transform",
                      row.getIsExpanded() && "rotate-90"
                    )}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <span className="font-medium text-xs whitespace-nowrap">{row.original.client}</span>
              </div>
            );
          }
          return <span className="font-medium text-xs whitespace-nowrap">{row.original.client}</span>;
        },
      },
      {
        id: "agent",
        accessorKey: "agent",
        header: "Agent",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{getValue() as string}</span>
        ),
      },
      {
        id: "q1_total",
        accessorKey: "q1_total",
        header: "Total Q1",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "q2_total",
        accessorKey: "q2_total",
        header: "Total Q2",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "q3_total",
        accessorKey: "q3_total",
        header: "Total Q3",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "q4_total",
        accessorKey: "q4_total",
        header: "Total Q4",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "total_anual",
        accessorKey: "total_anual",
        header: "Total Anual",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "reducere",
        accessorKey: "reducere",
        header: "Reducere 7.5%",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs italic text-muted-foreground text-right">
            {formatCurrency(getValue() as number)}
          </span>
        ),
      },
      {
        id: "total",
        accessorKey: "total",
        header: "Total",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold text-right text-primary">
            {formatCurrency(getValue() as number)}
          </span>
        ),
      },
      {
        id: "program",
        accessorKey: "program",
        header: "Program incadrare",
        cell: ({ row }) => (
          <ProgramBadge program={row.original.program} percent={row.original.procent} />
        ),
      },
      {
        id: "procent",
        accessorKey: "procent",
        header: "Procent",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return (
            <span className={cn(
              "text-xs font-medium",
              value === "-" ? "text-muted-foreground" : "text-primary"
            )}>
              {value}
            </span>
          );
        },
      },
      {
        id: "total_2025",
        accessorKey: "total_2025",
        header: "Total 2025",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "vs_2025_2026",
        accessorKey: "vs_2025_2026",
        header: "2025 vs 2026",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs italic text-muted-foreground text-right">
            {formatCurrency(getValue() as number)}
          </span>
        ),
      },
      {
        id: "bonus_crestere",
        accessorKey: "bonus_crestere",
        header: "Bonus crestere",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold text-right text-emerald-600">{(getValue() as number).toFixed(0)}%</span>
        ),
      },
      {
        id: "culoare_decolorare_q1",
        accessorKey: "culoare_decolorare_q1",
        header: "Culoare + Decolorare Q1",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "culoare_decolorare_q2",
        accessorKey: "culoare_decolorare_q2",
        header: "Culoare + Decolorare Q2",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "culoare_decolorare_q3",
        accessorKey: "culoare_decolorare_q3",
        header: "Culoare + Decolorare Q3",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "culoare_decolorare_q4",
        accessorKey: "culoare_decolorare_q4",
        header: "Culoare + Decolorare Q4",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "haircare_tehnic_q1",
        accessorKey: "haircare_tehnic_q1",
        header: "Tehnic Q1",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "haircare_tehnic_q2",
        accessorKey: "haircare_tehnic_q2",
        header: "Tehnic Q2",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "haircare_tehnic_q3",
        accessorKey: "haircare_tehnic_q3",
        header: "Tehnic Q3",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "haircare_tehnic_q4",
        accessorKey: "haircare_tehnic_q4",
        header: "Tehnic Q4",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-right">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "suma_bonus",
        accessorKey: "suma_bonus",
        header: "Suma bonus",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold text-right text-amber-600">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "suma_bonus_reducere",
        accessorKey: "suma_bonus_reducere",
        header: "Suma calcul bonus - 7.5%",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold text-right text-amber-700">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        id: "total_bonus",
        accessorKey: "total_bonus",
        header: "Total bonus",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold text-right text-amber-800">{(getValue() as number).toFixed(0)}%</span>
        ),
      },
      {
        id: "suma_voucher",
        accessorKey: "suma_voucher",
        header: "Suma voucher",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold text-right text-amber-900">{formatCurrency(getValue() as number)}</span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row: Row<EppRow>) => row.original.is_combined,
    onSortingChange: (updater) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);
    },
    state: {
      sorting,
    },
  });

  // Quarter column background colors
  const getQuarterBgColor = (columnId: string) => {
    switch (columnId) {
      case "q1_total":
        return "bg-blue-500/5";
      case "q2_total":
        return "bg-green-500/5";
      case "q3_total":
        return "bg-orange-500/5";
      case "q4_total":
        return "bg-red-500/5";
      case "culoare_decolorare_q1":
        return "bg-purple-500/5";
      case "culoare_decolorare_q2":
        return "bg-pink-500/5";
      case "culoare_decolorare_q3":
        return "bg-indigo-500/5";
      case "culoare_decolorare_q4":
        return "bg-violet-500/5";
      case "haircare_tehnic_q1":
        return "bg-cyan-500/5";
      case "haircare_tehnic_q2":
        return "bg-teal-500/5";
      case "haircare_tehnic_q3":
        return "bg-emerald-500/5";
      case "haircare_tehnic_q4":
        return "bg-lime-500/5";
      case "suma_bonus":
        return "bg-amber-500/10";
      case "suma_bonus_reducere":
        return "bg-amber-500/15";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Controls bar */}
      <div className="h-12 px-4 flex items-center justify-between gap-4 border-b border-border/50 bg-card/20">
        <div className="text-xs text-muted-foreground w-24">
          {filteredRows.length} client{filteredRows.length !== 1 ? "s" : ""}
          {searchQuery && ` (filtered)`}
        </div>

        {/* Search input - centered */}
        <div className="flex-1 flex justify-center">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Qualified filter checkbox */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border border-border/50">
            <Checkbox
              id="qualified-only"
              checked={showQualifiedOnly}
              onCheckedChange={(checked) => onQualifiedFilterChange(checked === true)}
              className="h-4 w-4"
            />
            <label
              htmlFor="qualified-only"
              className="text-xs font-medium cursor-pointer select-none whitespace-nowrap"
            >
              Qualified only (≥18k)
            </label>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="gap-2 h-8"
          >
            <Download size={14} />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="bg-card/80 border-b border-border/50"
              >
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className={cn(
                      "px-3 py-2 border-r border-border/30 font-medium text-xs whitespace-nowrap last:border-r-0",
                      h.column.getCanSort() && "cursor-pointer hover:bg-muted/30 select-none transition-colors group",
                      getQuarterBgColor(h.id)
                    )}
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      <span>{flexRender(h.column.columnDef.header, h.getContext())}</span>
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
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <React.Fragment key={row.id}>
                <tr
                  className={cn(
                    "border-b border-border/30 transition-colors hover:bg-primary/5",
                    row.original.is_combined && "bg-primary/[0.02]",
                    i % 2 === 0 ? "bg-background/30" : "bg-background/50"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-3 py-2 border-r border-border/30 last:border-r-0",
                        getQuarterBgColor(cell.column.id)
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr key={`${row.id}-expanded`} className="bg-muted/20 border-b border-border/30">
                    <td colSpan={table.getVisibleLeafColumns().length} className="px-6 py-2 text-xs text-muted-foreground">
                      <span className="font-medium">Source clients:</span>{" "}
                      {row.original.source_clients.join(", ")}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {filteredRows.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            {searchQuery ? (
              <>
                <p className="text-sm text-muted-foreground">No clients match &ldquo;{searchQuery}&rdquo;</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

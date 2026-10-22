"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Subgroup } from "@/types/subgroup";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, ChevronUp, ChevronDown, Pencil, SearchX, Trash2 } from "lucide-react";

export type SortField = "cod" | "denumire" | "grupa" | "subgrupa";
export type SortDirection = "asc" | "desc" | null;

interface SubgroupTableProps {
  rows: Subgroup[];
  totalCount: number;
  query: string;
  loading: boolean;
  hasFilters: boolean;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  onRowClick: (subgroup: Subgroup) => void;
  onDeleteClick: (subgroup: Subgroup) => void;
  onClearFilters: () => void;
}

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "cod", label: "Cod" },
  { key: "denumire", label: "Denumire" },
  { key: "grupa", label: "Grupa" },
  { key: "subgrupa", label: "Subgrupa" },
];

/** Marks the first case-insensitive match of the query inside a cell. */
function Highlight({ text, query }: { text: string; query: string }) {
  const term = query.trim();
  const index = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-primary/15 text-foreground">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell><div className="h-3 w-16 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-3 w-40 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-3 w-20 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-3 w-24 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}

export function SubgroupTable({
  rows,
  totalCount,
  query,
  loading,
  hasFilters,
  sortField,
  sortDirection,
  onSortChange,
  onRowClick,
  onDeleteClick,
  onClearFilters,
}: SubgroupTableProps) {
  useLanguage();

  const ariaSort = (field: SortField) => {
    if (sortField !== field || !sortDirection) return "none" as const;
    return sortDirection === "asc" ? ("ascending" as const) : ("descending" as const);
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3 w-3 text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary" />
    );
  };

  if (!loading && rows.length === 0) {
    if (!hasFilters) return null;
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <SearchX className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">{translate("No subgroups match your filters")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{translate("Try a different search or group.")}</p>
        </div>
        <Button variant="outline" size="sm" className="bg-background" onClick={onClearFilters}>
          {translate("Clear filters")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div aria-busy={loading} className={cn("overflow-x-auto transition-opacity duration-150", loading && rows.length > 0 && "opacity-60")}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((col) => (
                <TableHead key={col.key} aria-sort={ariaSort(col.key)} className="h-10">
                  <button
                    type="button"
                    onClick={() => onSortChange(col.key)}
                    className="flex items-center gap-1.5 rounded-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {translate(col.label)}
                    {sortIcon(col.key)}
                  </button>
                </TableHead>
              ))}
              <TableHead className="h-10 w-[5.5rem]">
                <span className="sr-only">{translate("Actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <SkeletonRows />
            ) : (
              rows.map((subgroup) => (
                <TableRow
                  key={subgroup.cod}
                  tabIndex={0}
                  onClick={() => onRowClick(subgroup)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onRowClick(subgroup);
                  }}
                  className="group cursor-pointer focus-visible:bg-primary/5 focus-visible:outline-none"
                >
                  <TableCell className="font-data font-medium tabular-nums">
                    <Highlight text={subgroup.cod} query={query} />
                  </TableCell>
                  <TableCell>
                    <Highlight text={subgroup.denumire} query={query} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      <Highlight text={subgroup.grupa} query={query} />
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Highlight text={subgroup.subgrupa} query={query} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={translate("Edit")}
                        title={translate("Edit")}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowClick(subgroup);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={translate("Delete")}
                        title={translate("Delete")}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteClick(subgroup);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && (
        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
          {translate("Showing {0} of {1}", { 0: rows.length, 1: totalCount })}
        </div>
      )}
    </>
  );
}

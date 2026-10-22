"use client";

import { ArrowDown, ArrowDownUp, ArrowUp, Gauge, X } from "lucide-react";
import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Calculation, ColumnMeta, SortColumn } from "@/types/report";
import { SectionCard, SectionHint } from "../SectionCard";

interface SortSectionProps {
  columns: ColumnMeta[];
  displayColumns: string[];
  groupBy: string[];
  calculations: Calculation[];
  sortBy: SortColumn[];
  onAdd: (sort: SortColumn) => void;
  onRemove: (index: number) => void;
  onToggleDirection: (index: number) => void;
  limit: number | null;
  onLimitChange: (limit: number | null) => void;
}

export function SortSection({
  columns,
  displayColumns,
  groupBy,
  calculations,
  sortBy,
  onAdd,
  onRemove,
  onToggleDirection,
  limit,
  onLimitChange,
}: SortSectionProps) {
  useLanguage();

  // Grouped reports can sort by group keys and results; flat reports by any shown column.
  const sortable = groupBy.length > 0
    ? [...columns.filter((c) => groupBy.includes(c.name)).map((c) => c.name), ...calculations.map((c) => c.alias)]
    : columns.filter((c) => displayColumns.includes(c.name)).map((c) => c.name);
  const unused = sortable.filter((name) => !sortBy.some((s) => s.column === name));

  const summary = [
    sortBy.length > 0 ? translate(sortBy.length === 1 ? "{count} sort level" : "{count} sort levels", { count: sortBy.length }) : translate("Natural order"),
    limit ? translate("up to {0} rows", { 0: limit.toLocaleString(getLocale()) }) : null,
  ].filter(Boolean).join(" · ");

  return (
    <SectionCard icon={ArrowDownUp} title={translate("Sort & limit")} summary={summary} count={sortBy.length} defaultOpen={false}>
      <Select value="" onValueChange={(column) => onAdd({ column, descending: false })} disabled={unused.length === 0}>
        <SelectTrigger aria-label={translate("Add a sort level")}>
          <SelectValue
            placeholder={unused.length === 0 ? translate("No more columns") : translate("Add a sort level")}
          />
        </SelectTrigger>
        <SelectContent>
          {unused.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {sortBy.length === 0 ? (
        <SectionHint icon={ArrowDownUp}>
          {translate("Rows keep their natural order. Add levels to sort the report by several columns.")}
        </SectionHint>
      ) : (
        <ol className="space-y-1.5">
          {sortBy.map((sort, index) => (
            <li
              key={sort.column}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 py-1.5 pl-2 pr-1 text-sm"
            >
              <span className="font-data flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-medium text-primary">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{sort.column}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onToggleDirection(index)}>
                {sort.descending ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                {sort.descending ? translate("Descending") : translate("Ascending")}
              </Button>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={translate("Remove {0}", { 0: sort.column })}
                className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="space-y-1.5 border-t border-border/60 pt-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" />
          {translate("Row limit")}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={limit ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              onLimitChange(raw === "" ? null : Math.max(1, Number.parseInt(raw, 10) || 1));
            }}
            placeholder={translate("No limit")}
            aria-label={translate("Row limit")}
            className="h-8 font-data text-xs"
          />
          {limit !== null && (
            <Button variant="ghost" size="sm" onClick={() => onLimitChange(null)}>
              {translate("Clear")}
            </Button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

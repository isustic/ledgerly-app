"use client";

import { useState } from "react";
import { Columns3, Search, X } from "lucide-react";
import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ColumnMeta } from "@/types/report";
import { SectionCard } from "../SectionCard";

interface ColumnsSectionProps {
  columns: ColumnMeta[];
  selected: string[];
  onToggle: (column: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

const TYPE_STYLES: Record<string, string> = {
  INTEGER: "bg-primary/10 text-primary",
  REAL: "bg-info/10 text-info",
  TEXT: "bg-warning/10 text-warning",
};

export function ColumnsSection({ columns, selected, onToggle, onSelectAll, onSelectNone }: ColumnsSectionProps) {
  useLanguage();
  const [search, setSearch] = useState("");

  const visible = columns.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));
  const allSelected = columns.length > 0 && selected.length === columns.length;

  const summary =
    columns.length === 0
      ? translate("No columns available")
      : translate("{0} of {1} selected", { 0: selected.length, 1: columns.length });

  return (
    <SectionCard icon={Columns3} title={translate("Columns")} summary={summary} count={selected.length}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={translate("Search columns…")}
          aria-label={translate("Search columns")}
          className="h-8 pl-8 pr-8 text-xs"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label={translate("Clear search")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-80 space-y-0.5 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{translate("No matching columns")}</p>
        ) : (
          visible.map((column) => {
            const isSelected = selected.includes(column.name);
            return (
              <label
                key={column.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-muted/50"
              >
                <Checkbox checked={isSelected} onCheckedChange={() => onToggle(column.name)} />
                <span className={cn("min-w-0 flex-1 truncate text-sm", !isSelected && "text-muted-foreground")}>
                  {column.name}
                </span>
                <Badge variant="outline" className={cn("border-transparent font-data", TYPE_STYLES[column.col_type.toUpperCase()])}>
                  {column.col_type.toLowerCase()}
                </Badge>
              </label>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <Button variant="ghost" size="sm" onClick={onSelectAll} disabled={allSelected}>
          {translate("Select all")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onSelectNone} disabled={selected.length === 0}>
          {translate("Select none")}
        </Button>
      </div>
    </SectionCard>
  );
}

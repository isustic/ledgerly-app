"use client";

import { useState } from "react";
import { Filter as FilterIcon, Plus, X } from "lucide-react";
import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getColumnType, getOperatorsForType } from "@/lib/query-preview";
import type { ColumnMeta, Filter } from "@/types/report";
import { SectionCard, SectionHint } from "../SectionCard";

interface FiltersSectionProps {
  columns: ColumnMeta[];
  filters: Filter[];
  onAdd: (filter: Filter) => void;
  onRemove: (index: number) => void;
}

export function FiltersSection({ columns, filters, onAdd, onRemove }: FiltersSectionProps) {
  useLanguage();
  const [column, setColumn] = useState("");
  const [operator, setOperator] = useState("");
  const [value, setValue] = useState("");

  const columnType = column ? getColumnType(column, columns) : "text";
  const operators = getOperatorsForType(columnType);
  const canAdd = Boolean(column && operator && value.trim());

  const handleColumnChange = (next: string) => {
    setColumn(next);
    setOperator("");
    setValue("");
  };

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ column, operator, value: value.trim() });
    setOperator("");
    setValue("");
  };

  const operatorLabel = (op: string) => translate(operators.find((o) => o.value === op)?.label ?? op);

  const summary =
    filters.length === 0
      ? translate("Optional · all rows included")
      : translate(filters.length === 1 ? "{count} condition" : "{count} conditions", { count: filters.length });

  return (
    <SectionCard icon={FilterIcon} title={translate("Filters")} summary={summary} count={filters.length} defaultOpen={false}>
      <div className="space-y-2">
        <Select value={column} onValueChange={handleColumnChange}>
          <SelectTrigger aria-label={translate("Column")}>
            <SelectValue placeholder={translate("Choose a column to filter")} />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col.id} value={col.name}>
                {col.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {column && (
          <div className="grid grid-cols-[8.5rem_1fr] gap-2">
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger aria-label={translate("Operator")}>
                <SelectValue placeholder={translate("Operator")} />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {translate(op.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type={columnType === "number" ? "number" : "text"}
              inputMode={columnType === "number" ? "decimal" : undefined}
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              disabled={!operator}
              placeholder={translate("Value")}
              aria-label={translate("Value")}
              className="h-9"
            />
          </div>
        )}

        <Button size="sm" className="w-full" onClick={handleAdd} disabled={!canAdd}>
          <Plus className="h-3.5 w-3.5" />
          {translate("Add condition")}
        </Button>
      </div>

      {filters.length === 0 ? (
        <SectionHint icon={FilterIcon}>
          {translate("Narrow the rows that feed the report. Conditions are combined with AND.")}
        </SectionHint>
      ) : (
        <ul className="space-y-1.5 border-t border-border/60 pt-3">
          {filters.map((filter, index) => (
            <li
              key={`${filter.column}-${index}`}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 py-1.5 pl-2 pr-1 text-xs"
            >
              {index > 0 && <span className="font-data text-xs uppercase text-muted-foreground">{translate("and")}</span>}
              <span className="min-w-0 truncate font-medium">{filter.column}</span>
              <span className="shrink-0 text-muted-foreground">{operatorLabel(filter.operator)}</span>
              <span className="font-data min-w-0 flex-1 truncate rounded bg-background px-1.5 py-0.5">{filter.value}</span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={translate("Remove {0}", { 0: filter.column })}
                className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

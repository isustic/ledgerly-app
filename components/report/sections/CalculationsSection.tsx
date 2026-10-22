"use client";

import { useState } from "react";
import { Plus, Sigma, Trash2 } from "lucide-react";
import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAggregationOptions } from "@/lib/query-preview";
import type { Calculation, ColumnMeta } from "@/types/report";
import { FieldLabel, SectionCard, SectionHint } from "../SectionCard";

type CalcFunction = Calculation["function"];

interface CalculationsSectionProps {
  columns: ColumnMeta[];
  calculations: Calculation[];
  hasGrouping: boolean;
  onAdd: (calc: Calculation) => void;
  onRemove: (index: number) => void;
  onRename: (index: number, alias: string) => void;
}

const FUNCTION_LABELS: Record<CalcFunction, string> = {
  sum: "Sum",
  count: "Count",
  avg: "Average",
  min: "Minimum",
  max: "Maximum",
};

export function CalculationsSection({
  columns,
  calculations,
  hasGrouping,
  onAdd,
  onRemove,
  onRename,
}: CalculationsSectionProps) {
  useLanguage();
  const [fn, setFn] = useState<CalcFunction>("sum");
  const [column, setColumn] = useState("");
  const [alias, setAlias] = useState("");

  const numericColumns = columns.filter((c) => ["INTEGER", "REAL"].includes(c.col_type.toUpperCase()));
  const defaultAlias = column ? `${fn}_${column}` : "";

  const summary = !hasGrouping
    ? translate("Needs a group-by column")
    : calculations.length === 0
      ? translate("Totals, averages and counts per group")
      : calculations.map((c) => c.alias).join(", ");

  const handleAdd = () => {
    if (!column) return;
    onAdd({ function: fn, column, alias: alias.trim() || defaultAlias });
    setColumn("");
    setAlias("");
  };

  return (
    <SectionCard icon={Sigma} title={translate("Calculate")} summary={summary} count={calculations.length} defaultOpen={false}>
      {!hasGrouping ? (
        <SectionHint icon={Sigma}>
          {translate("Calculations summarise each group. Add a group-by column to enable them.")}
        </SectionHint>
      ) : (
        <>
          <div className="grid grid-cols-[7.5rem_1fr] gap-2">
            <div className="space-y-1.5">
              <FieldLabel>{translate("Function")}</FieldLabel>
              <Select value={fn} onValueChange={(v) => setFn(v as CalcFunction)}>
                <SelectTrigger aria-label={translate("Function")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAggregationOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {translate(FUNCTION_LABELS[option.value as CalcFunction])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>{translate("Column")}</FieldLabel>
              <Select value={column} onValueChange={setColumn} disabled={numericColumns.length === 0}>
                <SelectTrigger aria-label={translate("Column")}>
                  <SelectValue
                    placeholder={
                      numericColumns.length === 0 ? translate("No numeric columns") : translate("Select column")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns.map((col) => (
                    <SelectItem key={col.id} value={col.name}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>{translate("Result name")}</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && column && handleAdd()}
                placeholder={defaultAlias || translate("Calculation name")}
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={handleAdd} disabled={!column}>
                <Plus className="h-3.5 w-3.5" />
                {translate("Add")}
              </Button>
            </div>
          </div>

          {calculations.length > 0 && (
            <ul className="space-y-1.5 border-t border-border/60 pt-3">
              {calculations.map((calc, index) => (
                <li
                  key={`${calc.function}-${calc.column}-${index}`}
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 py-1.5 pl-2 pr-1 text-xs"
                >
                  <span className="font-data shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    {calc.function.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {calc.column}
                  </span>
                  <AliasEditor value={calc.alias} onCommit={(next) => onRename(index, next)} />
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    aria-label={translate("Remove {0}", { 0: calc.alias })}
                    className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </SectionCard>
  );
}

/** Commits a rename on blur or Enter; an empty name reverts instead of breaking the query. */
function AliasEditor({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setDraft(value);
  }

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      aria-label={translate("Result name")}
      className="min-w-0 max-w-[9rem] flex-1 rounded bg-transparent px-1 py-0.5 text-sm font-medium outline-none transition-colors duration-150 focus:bg-background focus:ring-2 focus:ring-ring/30"
    />
  );
}

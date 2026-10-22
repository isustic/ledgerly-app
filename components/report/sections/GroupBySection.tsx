"use client";

import { Layers, Plus, X } from "lucide-react";
import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard, SectionHint } from "../SectionCard";

interface GroupBySectionProps {
  selected: string[];
  groupBy: string[];
  onAdd: (column: string) => void;
  onRemove: (column: string) => void;
}

export function GroupBySection({ selected, groupBy, onAdd, onRemove }: GroupBySectionProps) {
  useLanguage();
  const available = selected.filter((c) => !groupBy.includes(c));

  const summary =
    groupBy.length === 0
      ? translate("Optional · one row per record")
      : groupBy.join(" → ");

  return (
    <SectionCard icon={Layers} title={translate("Group by")} summary={summary} count={groupBy.length} defaultOpen={false}>
      <Select value="" onValueChange={onAdd} disabled={available.length === 0}>
        <SelectTrigger aria-label={translate("Add a grouping column")}>
          <SelectValue
            placeholder={
              available.length === 0
                ? translate("No more columns available")
                : translate("Add a grouping column")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {available.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {groupBy.length === 0 ? (
        <SectionHint icon={Plus}>
          {translate("Group rows by one or more columns to summarise them with calculations.")}
        </SectionHint>
      ) : (
        <ol className="space-y-1.5">
          {groupBy.map((column, index) => (
            <li
              key={column}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 py-1.5 pl-2 pr-1 text-sm"
            >
              <span className="font-data flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-medium text-primary">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{column}</span>
              <button
                type="button"
                onClick={() => onRemove(column)}
                aria-label={translate("Remove {0}", { 0: column })}
                className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

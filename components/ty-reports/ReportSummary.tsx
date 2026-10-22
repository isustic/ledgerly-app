"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TyReport } from "@/components/ty-reports/types";

export const formatReportDate = (value: string) => {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(getLocale(), { day: "numeric", month: "short", year: "numeric" });
};

interface ReportSummaryProps {
  report: TyReport;
  className?: string;
}

type Tone = "sky" | "emerald" | "violet" | "amber";

const TONE_DOT: Record<Tone, string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
};

// Same KPI tile style as the EPP summary, fed from the report's own metadata.
export function ReportSummary({ report, className }: ReportSummaryProps) {
  useLanguage();
  const cards: Array<{ label: string; value: string; tone: Tone }> = [
    {
      label: translate("Rows"),
      value: report.row_count.toLocaleString(getLocale()),
      tone: "sky",
    },
    {
      label: translate("Source file"),
      value: report.original_file_name,
      tone: "violet",
    },
    {
      label: translate("Imported"),
      value: formatReportDate(report.created_at),
      tone: "emerald",
    },
    {
      label: translate("Last updated"),
      value: formatReportDate(report.updated_at),
      tone: "amber",
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 gap-3 xl:grid-cols-4", className)}>
      {cards.map((card) => (
        <Card key={card.label} className="border-border/60 bg-card">
          <CardContent className="min-w-0 space-y-1 p-3 xl:p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[card.tone])} aria-hidden="true" />
              <span className="truncate">{card.label}</span>
            </div>
            <p className="truncate text-sm font-semibold tabular-nums xl:text-base" title={card.value}>
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

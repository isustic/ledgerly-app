"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SubgroupSummaryProps {
  total: number;
  groupCount: number;
  largestGroup: { name: string; count: number } | null;
  shown: number;
}

type Tone = "sky" | "emerald" | "violet" | "amber";

const TONE_DOT: Record<Tone, string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
};

export function SubgroupSummary({ total, groupCount, largestGroup, shown }: SubgroupSummaryProps) {
  useLanguage();

  const formatNumber = (value: number) =>
    new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 }).format(value);

  const cards: Array<{ label: string; value: string; hint?: string; tone: Tone }> = [
    { label: translate("Subgroups"), value: formatNumber(total), tone: "sky" },
    { label: translate("Groups"), value: formatNumber(groupCount), tone: "emerald" },
    {
      label: translate("Largest group"),
      value: largestGroup ? largestGroup.name : "—",
      hint: largestGroup ? formatNumber(largestGroup.count) : undefined,
      tone: "violet",
    },
    { label: translate("Shown"), value: formatNumber(shown), tone: "amber" },
  ];

  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/60 bg-card">
          <CardContent className="space-y-1 p-3 xl:p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[card.tone])} aria-hidden="true" />
              <span className="truncate">{card.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="font-data truncate text-base font-bold tabular-nums xl:text-xl" title={card.value}>
                {card.value}
              </p>
              {card.hint && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{card.hint}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

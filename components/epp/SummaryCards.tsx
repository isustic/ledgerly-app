"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  clientCount: number;
  qualifiedCount: number;
  totalAnual: number;
  averagePerClient: number;
  className?: string;
}

type Tone = "sky" | "emerald" | "violet" | "amber";

const TONE_DOT: Record<Tone, string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
};

export function SummaryCards({
  clientCount,
  qualifiedCount,
  totalAnual,
  averagePerClient,
  className,
}: SummaryCardsProps) {
  useLanguage();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(getLocale(), {
      style: "currency",
      currency: "RON",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 }).format(value);

  const cards: Array<{ label: string; value: string; tone: Tone }> = [
    { label: translate("Clients"), value: formatNumber(clientCount), tone: "sky" },
    { label: translate("Qualified"), value: formatNumber(qualifiedCount), tone: "emerald" },
    { label: translate("Total Anual"), value: formatCurrency(totalAnual), tone: "violet" },
    { label: translate("Avg/Client"), value: formatCurrency(averagePerClient), tone: "amber" },
  ];

  return (
    <div className={cn("grid grid-cols-2 gap-3 xl:grid-cols-4", className)}>
      {cards.map((card) => (
        <Card key={card.label} className="border-border/60 bg-card">
          <CardContent className="space-y-1 p-3 xl:p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[card.tone])} aria-hidden="true" />
              <span className="truncate">{card.label}</span>
            </div>
            <p className="font-data truncate text-base font-bold tabular-nums xl:text-xl" title={card.value}>
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

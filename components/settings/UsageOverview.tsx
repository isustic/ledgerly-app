"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./SettingsCard";
import type { ActivityDay, UsageStats } from "./types";

const WEEKS = 12;
const DAYS = 7;

// Empty cell, then four intensity steps. Uses the primary token so it matches the rest of the app.
const LEVEL_CLASSES = ["bg-muted", "bg-primary/25", "bg-primary/55", "bg-primary"];

const TONE_DOT: Record<"sky" | "emerald" | "amber", string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
};

function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function levelFor(count: number) {
  if (count === 0) return LEVEL_CLASSES[0];
  if (count <= 2) return LEVEL_CLASSES[1];
  if (count <= 5) return LEVEL_CLASSES[2];
  return LEVEL_CLASSES[3];
}

/** Columns are weeks, ending with today. Each cell is one local calendar day. */
function buildHeatmap(activity: ActivityDay[]) {
  const counts = new Map(activity.map((entry) => [entry.date, entry.count]));
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return Array.from({ length: WEEKS }, (_, week) =>
    Array.from({ length: DAYS }, (_, day) => {
      const offset = (WEEKS - 1 - week) * DAYS + (DAYS - 1 - day);
      const date = new Date(todayStart);
      date.setDate(todayStart.getDate() - offset);
      const key = toDateKey(date);
      return { date: key, count: counts.get(key) ?? 0 };
    })
  );
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label={translate("Loading")} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-[88px] animate-pulse rounded-xl border border-border/60 bg-muted/50" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl border border-border/60 bg-muted/50" />
    </div>
  );
}

interface UsageOverviewProps {
  stats: UsageStats | null;
  activity: ActivityDay[];
  loading: boolean;
}

export function UsageOverview({ stats, activity, loading }: UsageOverviewProps) {
  useLanguage();
  const grid = useMemo(() => buildHeatmap(activity), [activity]);

  const formatNumber = (value: number) => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 }).format(value);

  if (!stats) return loading ? <LoadingSkeleton /> : null;

  const tiles: { label: string; value: number; tone: keyof typeof TONE_DOT }[] = [
    { label: translate("Datasets"), value: stats.datasets_count, tone: "sky" },
    { label: translate("Reports Run"), value: stats.reports_run, tone: "emerald" },
    { label: translate("Total Rows"), value: stats.total_rows, tone: "amber" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label} className="border-border/60 bg-card shadow-sm">
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[tile.tone])} aria-hidden="true" />
                <span className="truncate">{tile.label}</span>
              </div>
              <p className="font-data text-xl font-bold tabular-nums">{formatNumber(tile.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SettingsCard
        title={translate("Activity")}
        action={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{translate("Less")}</span>
            <div className="flex gap-0.5" aria-hidden="true">
              {LEVEL_CLASSES.map((level) => (
                <span key={level} className={cn("h-3 w-3 rounded-sm", level)} />
              ))}
            </div>
            <span>{translate("More")}</span>
          </div>
        }
      >
        <div className="overflow-x-auto p-4">
          <div className="flex w-max gap-1">
            {grid.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-1">
                {week.map((day) => (
                  <div
                    key={day.date}
                    className={cn("h-3 w-3 rounded-sm transition-shadow hover:ring-1 hover:ring-primary/50", levelFor(day.count))}
                    title={translate("{0}: {1} actions", { 0: day.date, 1: day.count })}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </SettingsCard>

      {stats.most_used_columns.length > 0 && (
        <SettingsCard title={translate("Most Used Columns")}>
          <div className="flex flex-wrap gap-2 p-4">
            {stats.most_used_columns.map((col) => (
              <div
                key={col.column_name}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/50 px-2.5 py-1 text-xs"
              >
                <span className="font-medium">{col.column_name}</span>
                <span className="font-data text-muted-foreground tabular-nums">{col.usage_count}×</span>
              </div>
            ))}
          </div>
        </SettingsCard>
      )}
    </div>
  );
}

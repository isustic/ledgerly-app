"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getLastOpenedDataset, setLastOpenedDataset } from "@/lib/dataset-tracking";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, FileSpreadsheet, BarChart3, TrendingUp, Database, Clock, History, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeInvoke } from "@/lib/tauri";
import { UploadCard } from "@/components/dashboard/UploadCard";

interface Dataset {
    id: number;
    name: string;
    file_origin: string;
    table_name: string;
    row_count: number;
    created_at: string;
}

interface UsageStats {
    datasets_count: number;
    reports_run: number;
    total_rows: number;
    most_used_columns: Array<{ column_name: string; usage_count: number }>;
}

interface ReturningDashboardProps {
    datasets: Dataset[];
}

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(getLocale(), {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

export function ReturningDashboard({ datasets }: ReturningDashboardProps) {
    useLanguage();
    const router = useRouter();
    const [stats, setStats] = useState<UsageStats | null>(null);

    const sorted = useMemo(
        () => [...datasets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        [datasets]
    );
    const recent = sorted.slice(0, 5);

    const lastDataset = useMemo<Dataset | null>(() => {
        const lastId = getLastOpenedDataset();
        return (lastId && datasets.find((d) => d.id === lastId)) || sorted[0] || null;
    }, [datasets, sorted]);

    useEffect(() => {
        safeInvoke<UsageStats>("get_usage_stats")
            .then(setStats)
            .catch((err) => console.error("Failed to load stats:", err));
    }, [datasets]);

    const openDataset = useCallback(
        (id: number) => {
            setLastOpenedDataset(id);
            router.push(`/upload?dataset=${id}`);
        },
        [router]
    );

    const quickActions = [
        {
            label: translate("New report"),
            description: translate("Group, calculate, chart"),
            icon: BarChart3,
            tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
            href: lastDataset ? `/report?dataset=${lastDataset.id}` : null,
        },
        {
            label: translate("EPro analysis"),
            description: translate("Agent and program reports"),
            icon: TrendingUp,
            tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
            href: lastDataset ? `/epp?dataset=${lastDataset.id}` : null,
        },
        {
            label: translate("History"),
            description: translate("All past imports"),
            icon: History,
            tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            href: "/istoric",
        },
    ];

    const statCards = stats
        ? [
              { label: translate("Datasets"), value: stats.datasets_count.toLocaleString(getLocale()), wrapValue: false, icon: Database, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
              { label: translate("Total rows"), value: stats.total_rows.toLocaleString(getLocale()), wrapValue: false, icon: Table2, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
              { label: translate("Reports run"), value: stats.reports_run.toLocaleString(getLocale()), wrapValue: false, icon: BarChart3, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
              { label: translate("Last activity"), value: lastDataset ? formatDate(lastDataset.created_at) : "—", wrapValue: true, icon: Clock, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
          ]
        : [];

    return (
        <div className="bg-background">
            <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-10">
                {/* Header */}
                <div className="mb-8">
                    <p className="mb-1 text-sm font-medium text-primary">{translate("Welcome back")}</p>
                    <h1 className="text-3xl font-bold tracking-tight">{translate("Your data, at a glance")}</h1>
                </div>

                <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-5">
                    {/* Continue hero */}
                    {lastDataset && (
                        <Card
                            role="button"
                            tabIndex={0}
                            onClick={() => openDataset(lastDataset.id)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openDataset(lastDataset.id);
                                }
                            }}
                            className="group cursor-pointer lg:col-span-3 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <CardContent className="flex h-full flex-col justify-between gap-6 p-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                                        <FileSpreadsheet className="h-6 w-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium uppercase tracking-wide text-primary">{translate("Continue where you left off")}</p>
                                        <p className="truncate text-xl font-semibold">{lastDataset.name}</p>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                            <Badge variant="secondary" className="font-data text-xs">
                                                {lastDataset.row_count.toLocaleString(getLocale())} {" "}{translate("rows")}</Badge>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3.5 w-3.5" />
                                                {formatDate(lastDataset.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                    {translate("Open data table")}<ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Import */}
                    <div className={cn(lastDataset ? "lg:col-span-2" : "lg:col-span-5")}>
                        <UploadCard compact title={translate("Add a dataset")} subtitle="Drop an .xlsx file or browse" />
                    </div>
                </div>

                {/* Quick actions */}
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {quickActions.map((action) => {
                        const disabled = action.href === null;
                        return (
                            <Card
                                key={action.label}
                                role="button"
                                tabIndex={disabled ? -1 : 0}
                                aria-disabled={disabled}
                                onClick={() => !disabled && router.push(action.href!)}
                                onKeyDown={(e) => {
                                    if (!disabled && (e.key === "Enter" || e.key === " ")) {
                                        e.preventDefault();
                                        router.push(action.href!);
                                    }
                                }}
                                className={cn(
                                    "group border-border/60 bg-card transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    disabled ? "opacity-50" : "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                                )}
                            >
                                <CardContent className="flex items-center gap-4 p-4">
                                    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", action.tone)}>
                                        <action.icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold">{translate(action.label)}</p>
                                        <p className="text-xs text-muted-foreground">{translate(action.description)}</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Stats */}
                {statCards.length > 0 && (
                    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {statCards.map((stat) => (
                            <Card key={stat.label} className="border-border/60 bg-card">
                                <CardContent className="flex items-center gap-3 p-4">
                                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", stat.tone)}>
                                        <stat.icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={cn("font-data text-xl font-bold", stat.wrapValue ? "whitespace-normal break-words text-base leading-tight" : "truncate")}>{stat.value}</p>
                                        <p className="text-xs text-muted-foreground">{translate(stat.label)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Recent datasets */}
                {recent.length > 0 && (
                    <section>
                        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{translate("Recent imports")}</h2>
                        <Card className="border-border/60 bg-card">
                            <ul className="divide-y divide-border">
                                {recent.map((d) => (
                                    <li key={d.id}>
                                        <button
                                            type="button"
                                            onClick={() => openDataset(d.id)}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                                        >
                                            <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
                                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
                                            <span className="font-data hidden text-xs text-muted-foreground sm:block">
                                                {d.row_count.toLocaleString(getLocale())} {" "}{translate("rows")}</span>
                                            <span className="hidden text-xs text-muted-foreground md:block">{formatDate(d.created_at)}</span>
                                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </section>
                )}
            </div>
        </div>
    );
}

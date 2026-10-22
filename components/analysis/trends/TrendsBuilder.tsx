"use client";

import { translate, translateMessage, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Play, LoaderIcon, AlertCircleIcon, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { SparklineChart } from "./SparklineChart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface TrendsBuilderProps {
    datasetId: number;
    columns: string[];
}

interface TrendsResult {
    periods: string[];
    values: number[];
    metrics: {
        total: number;
        avg: number;
        min: number;
        max: number;
        growth: number;
    };
}

// Format period strings - backend now handles Excel date conversion
function formatPeriod(period: string): string {
    // Backend should return YYYY-MM format, just validate and return
    if (/^\d{4}-\d{2}$/.test(period)) {
        return period;
    }

    // Fallback for unexpected formats
    return period;
}

export function TrendsBuilder({ datasetId, columns }: TrendsBuilderProps) {
    useLanguage();
    const [dateColumn, setDateColumn] = useState<string>("");
    const [valueColumn, setValueColumn] = useState<string>("");
    const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "quarterly" | "yearly">("monthly");
    const [aggregation, setAggregation] = useState<"sum" | "avg" | "count">("sum");
    const [result, setResult] = useState<TrendsResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Format periods for display
    const formattedData = useMemo(() => {
        if (!result) return null;
        return {
            ...result,
            periods: result.periods.map(formatPeriod)
        };
    }, [result]);

    // Show all columns - let user decide which is date vs value
    // Sort columns with date/time hints first for convenience
    const allColumns = [...columns].sort((a, b) => {
        const aIsDate = a.toLowerCase().includes("date") || a.toLowerCase().includes("time");
        const bIsDate = b.toLowerCase().includes("date") || b.toLowerCase().includes("time");
        if (aIsDate && !bIsDate) return -1;
        if (!aIsDate && bIsDate) return 1;
        return a.localeCompare(b);
    });

    const handleRun = async () => {
        if (!dateColumn || !valueColumn) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await invoke<TrendsResult>("run_trends_query", {
                datasetId,
                config: {
                    date_column: dateColumn,
                    value_column: valueColumn,
                    period,
                    aggregation,
                },
            });
            console.log("=== TRENDS RAW RESULT ===");
            console.log("Periods:", res.periods);
            console.log("Values:", res.values);
            console.log("==========================");
            setResult(res);
        } catch (err) {
            console.error("Trends query failed:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(`Failed to run trends query: ${errorMessage}. Please check your configuration and try again.`);
            setResult(null);
        } finally {
            setIsLoading(false);
        }
    };

    const selectClass = "h-9 w-full";
    const labelClass = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
    const positive = (n: number) => n >= 0;

    return (
        <div className="space-y-6">
            {/* Config toolbar */}
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
                    <div className="space-y-1.5">
                        <label className={labelClass}>{translate("Date Column")}</label>
                        <Select value={dateColumn} onValueChange={setDateColumn} disabled={isLoading}>
                            <SelectTrigger className={selectClass}>
                                <SelectValue placeholder={translate("Select...")} />
                            </SelectTrigger>
                            <SelectContent>
                                {allColumns.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className={labelClass}>{translate("Value Column")}</label>
                        <Select value={valueColumn} onValueChange={setValueColumn} disabled={isLoading}>
                            <SelectTrigger className={selectClass}>
                                <SelectValue placeholder={translate("Select...")} />
                            </SelectTrigger>
                            <SelectContent>
                                {allColumns.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className={labelClass}>{translate("Period")}</label>
                        <Select value={period} onValueChange={(v) => setPeriod(v as "daily" | "weekly" | "monthly" | "quarterly" | "yearly")} disabled={isLoading}>
                            <SelectTrigger className={selectClass}>
                                <SelectValue placeholder={translate("Select...")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">{translate("Daily")}</SelectItem>
                                <SelectItem value="weekly">{translate("Weekly")}</SelectItem>
                                <SelectItem value="monthly">{translate("Monthly")}</SelectItem>
                                <SelectItem value="quarterly">{translate("Quarterly")}</SelectItem>
                                <SelectItem value="yearly">{translate("Yearly")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <label className={labelClass}>{translate("Aggregation")}</label>
                        <Select value={aggregation} onValueChange={(v) => setAggregation(v as "sum" | "avg" | "count")} disabled={isLoading}>
                            <SelectTrigger className={selectClass}>
                                <SelectValue placeholder={translate("Select...")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sum">{translate("Sum")}</SelectItem>
                                <SelectItem value="avg">{translate("Average")}</SelectItem>
                                <SelectItem value="count">{translate("Count")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        onClick={handleRun}
                        disabled={!dateColumn || !valueColumn || isLoading}
                        className="h-9 w-full xl:w-auto xl:px-5"
                    >
                        {isLoading ? (
                            <LoaderIcon className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="mr-1.5 h-4 w-4" />
                        )}
                        {isLoading ? translate("Running...") : translate("Run trends")}
                    </Button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircleIcon className="h-4 w-4" />
                    <AlertDescription>{translateMessage(error)}</AlertDescription>
                </Alert>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <LoaderIcon className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">{translate("Running trends analysis...")}</p>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !formattedData && !error && (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">{translate("Pick a date and a value column")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{translate("Then choose a period and run the trend.")}</p>
                </div>
            )}

            {/* Results */}
            {!isLoading && formattedData && (
                <div className="space-y-6">
                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                            <p className={labelClass}>{translate("Total")}</p>
                            <p className="font-data mt-2 text-2xl font-bold tracking-tight">{formattedData.metrics.total.toLocaleString(getLocale())}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                            <p className={labelClass}>{translate("Average")}</p>
                            <p className="font-data mt-2 text-2xl font-bold tracking-tight">{formattedData.metrics.avg.toLocaleString(getLocale(), { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                            <p className={labelClass}>{translate("Min / Max")}</p>
                            <p className="font-data mt-2 text-2xl font-bold tracking-tight">{formattedData.metrics.min} / {formattedData.metrics.max}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                            <p className={labelClass}>{translate("Growth")}</p>
                            <p className={`font-data mt-2 flex items-center gap-1.5 text-2xl font-bold tracking-tight ${positive(formattedData.metrics.growth) ? "text-primary" : "text-destructive"}`}>
                                {positive(formattedData.metrics.growth) ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                                {formattedData.metrics.growth >= 0 ? "+" : ""}{formattedData.metrics.growth.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                            </p>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">{translate("Trend")}</h3>
                            <span className="text-xs text-muted-foreground">{formattedData.periods.length} {translate("periods")}</span>
                        </div>
                        <div className="flex justify-center">
                            <SparklineChart data={formattedData.values} width={800} height={160} />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                        <div className="max-h-[420px] overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        <th className="px-4 py-2.5">{translate("Period")}</th>
                                        <th className="px-4 py-2.5 text-right">{translate("Value")}</th>
                                        <th className="px-4 py-2.5 text-right">{translate("Change")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formattedData.periods.map((period, i) => {
                                        const change = i > 0 ? (formattedData.values[i] - formattedData.values[i - 1]) / formattedData.values[i - 1] * 100 : null;
                                        return (
                                            <tr key={i} className="border-t border-border/50 transition-colors hover:bg-muted/40">
                                                <td className="px-4 py-2 font-medium">{period}</td>
                                                <td className="font-data px-4 py-2 text-right">{formattedData.values[i]?.toLocaleString(getLocale())}</td>
                                                <td className={`font-data px-4 py-2 text-right ${change === null ? "text-muted-foreground" : change >= 0 ? "text-primary" : "text-destructive"}`}>
                                                    {change === null ? "–" : `${change.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

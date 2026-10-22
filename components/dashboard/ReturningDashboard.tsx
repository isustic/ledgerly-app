"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getLastOpenedDataset } from "@/lib/dataset-tracking";
import { setLastOpenedDataset } from "@/lib/dataset-tracking";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, FileSpreadsheet, BarChart3, Plus, TrendingUp, Database, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeInvoke, safeOpen, safeListen } from "@/lib/tauri";

type UnlistenFn = () => void;

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

interface IngestProgress {
    pct: number;
    rows_done: number;
}

interface ReturningDashboardProps {
    datasets: Dataset[];
}

export function ReturningDashboard({ datasets }: ReturningDashboardProps) {
    const router = useRouter();
    const [lastDataset, setLastDataset] = useState<Dataset | null>(null);
    const [stats, setStats] = useState<UsageStats | null>(null);
    const [lastAccessed, setLastAccessed] = useState<string>("");

    // Upload state
    const [isIngesting, setIsIngesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [rowsDone, setRowsDone] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const unlistenRef = useRef<UnlistenFn | null>(null);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const loadDashboardData = async () => {
        // Get last opened from localStorage
        const lastId = getLastOpenedDataset();

        // Find the dataset
        let selected: Dataset | null = null;
        if (lastId) {
            selected = datasets.find((d) => d.id === lastId) || null;
        }

        // Fallback to most recent if no last opened
        if (!selected && datasets.length > 0) {
            selected = datasets.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
        }

        setLastDataset(selected);
        if (selected) {
            setLastAccessed(formatDate(selected.created_at));
        }

        // Load stats
        try {
            const statsData = await safeInvoke<UsageStats>("get_usage_stats");
            setStats(statsData);
        } catch (err) {
            console.error("Failed to load stats:", err);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, [datasets]);

    const handleContinue = useCallback(() => {
        if (lastDataset) {
            router.push(`/upload?dataset=${lastDataset.id}`);
        }
    }, [lastDataset, router]);

    const handleNewReport = useCallback(() => {
        if (lastDataset) {
            router.push(`/report?dataset=${lastDataset.id}`);
        }
    }, [lastDataset, router]);

    const handleEPro = useCallback(() => {
        if (lastDataset) {
            router.push(`/epp?dataset=${lastDataset.id}`);
        }
    }, [lastDataset, router]);

    const handleUpload = useCallback(async () => {
        setUploadError(null);
        const selected = await safeOpen({
            filters: [{ name: "Excel File", extensions: ["xlsx"] }],
            multiple: false,
        });

        if (typeof selected === "string") {
            setIsIngesting(true);
            setProgress(0);
            setRowsDone(0);

            // Subscribe to progress events
            unlistenRef.current = await safeListen<IngestProgress>("ingest_progress", (ev) => {
                setProgress(ev.payload.pct);
                setRowsDone(ev.payload.rows_done);
            });

            try {
                const datasetName = selected.split("/").pop()?.replace(".xlsx", "") ?? "Dataset";
                const result = await safeInvoke<{ id: number }>("ingest_file", {
                    path: selected,
                    datasetName,
                });
                setProgress(100);

                // Set as last opened and navigate to upload page
                setLastOpenedDataset(result.id);
                router.push(`/upload?dataset=${result.id}`);
            } catch (err) {
                setUploadError(String(err));
                setIsIngesting(false);
                unlistenRef.current?.();
            }
        }
    }, [router]);

    const quickActions = [
        {
            label: "Continue",
            icon: ArrowRight,
            onClick: handleContinue,
            primary: true,
            description: "Open data table"
        },
        {
            label: "New Report",
            icon: BarChart3,
            onClick: handleNewReport,
            primary: false,
            description: "Build a report"
        },
        {
            label: "EPro Analysis",
            icon: TrendingUp,
            onClick: handleEPro,
            primary: false,
            description: "EPro reports"
        },
        {
            label: "Upload New",
            icon: Plus,
            onClick: handleUpload,
            primary: false,
            description: "Add dataset"
        }
    ];

    const statCards = stats ? [
        { label: "Datasets", value: stats.datasets_count, icon: Database },
        { label: "Total Rows", value: stats.total_rows.toLocaleString(), icon: FileSpreadsheet },
        { label: "Reports Run", value: stats.reports_run, icon: BarChart3 },
        { label: "Last Activity", value: lastAccessed, icon: Clock }
    ] : [];

    return (
        <div className="bg-background">
            <div className="container mx-auto px-4 py-8">
                {/* Welcome Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
                    {lastDataset && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="font-medium">{lastDataset.name}</span>
                            <Badge variant="secondary" className="text-xs">
                                {lastDataset.row_count.toLocaleString()} rows
                            </Badge>
                            {lastAccessed && (
                                <span className="text-sm">· Last opened {lastAccessed}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Upload Progress */}
                {isIngesting && (
                    <div className="mb-6 p-4 rounded-lg bg-card/50 border border-border/50 animate-fade-in">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <Sparkles size={14} className="animate-pulse text-primary" />
                                Uploading new dataset…
                            </span>
                            <span className="text-sm font-data text-primary">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1 font-data">
                            {rowsDone.toLocaleString()} rows processed
                        </p>
                    </div>
                )}

                {/* Upload Error */}
                {uploadError && (
                    <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive flex items-start gap-2">
                            <span>⚠</span>
                            <span>{uploadError}</span>
                        </p>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {quickActions.map((action) => (
                        <Card
                            key={action.label}
                            className={cn(
                                "cursor-pointer transition-colors duration-150 hover:border-primary/50 active:scale-[0.99]",
                                action.primary
                                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                                    : "border-border bg-card hover:bg-muted/50",
                                isIngesting && "pointer-events-none opacity-50"
                            )}
                            onClick={action.onClick}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center",
                                        action.primary ? "bg-primary/20" : "bg-muted"
                                    )}>
                                        <action.icon className={cn(
                                            "w-5 h-5",
                                            action.primary ? "text-primary" : "text-muted-foreground"
                                        )} />
                                    </div>
                                    <div>
                                        <p className={cn(
                                            "font-semibold",
                                            action.primary ? "text-primary" : ""
                                        )}>
                                            {action.label}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {action.description}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Stats Grid */}
                {statCards.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {statCards.map((stat) => (
                            <Card key={stat.label} className="border-border/50 bg-card/50">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <stat.icon className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{stat.value}</p>
                                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

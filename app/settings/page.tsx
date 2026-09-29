"use client";

import { useEffect, useState } from "react";
import {
    Sun, Moon,
    Database, BarChart3, TrendingUp, Clock, Star,
    Trash2, Package, AlertTriangle, FileSpreadsheet,
    GitCompare, Download, CheckCircle2, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeInvoke, safeConfirm } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { UpdateDialog, type UpdateInfo } from "@/components/UpdateDialog";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Analytics types
interface UsageStats {
    datasets_count: number;
    reports_run: number;
    total_rows: number;
    most_used_columns: ColumnUsage[];
}

interface ColumnUsage {
    column_name: string;
    usage_count: number;
}

interface ActivityDay {
    date: string;
    count: number;
}

interface QueryEntry {
    id: number;
    report_config: string;
    row_count: number;
    timestamp: string;
}

interface Favorite {
    id: number;
    item_type: string;
    item_id: number;
    name: string;
    created_at: string;
}

interface Dataset {
    id: number;
    name: string;
    file_origin: string;
    table_name: string;
    row_count: number;
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UpdateSettings Component
// ─────────────────────────────────────────────────────────────────────────────
function UpdateSettings() {
    const [checking, setChecking] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
    const [update, setUpdate] = useState<UpdateInfo | null>(null);

    const checkNow = async () => {
        setChecking(true);
        setStatus(null);
        try {
            const info = await safeInvoke<UpdateInfo | null>('check_for_updates');
            if (info) {
                setUpdate(info);
                setStatus({ type: 'success', message: `Version ${info.version} is available.` });
            } else {
                setStatus({ type: 'info', message: "You're on the latest version." });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Could not check for updates.' });
        }
        setChecking(false);
    };

    return (
        <div className="bg-card/30 border border-border/40 rounded-xl p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Download className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">App Updates</p>
                        <p className="text-[10px] text-muted-foreground">Check for new versions</p>
                    </div>
                </div>
                <Button
                    onClick={checkNow}
                    disabled={checking}
                    variant="outline"
                    size="sm"
                >
                    {checking ? (
                        <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            Checking...
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5">
                            <Download size={14} />
                            Check for Updates
                        </span>
                    )}
                </Button>
            </div>
            {status && (
                <div className={cn(
                    "mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                    status.type === 'success' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    status.type === 'info' && "bg-primary/10 text-primary",
                    status.type === 'error' && "bg-destructive/10 text-destructive"
                )}>
                    {status.type === 'success' && <CheckCircle2 size={14} />}
                    {status.type === 'info' && <Info size={14} />}
                    {status.type === 'error' && <AlertTriangle size={14} />}
                    <span>{status.message}</span>
                </div>
            )}
            <UpdateDialog open={update !== null} update={update} onClose={() => setUpdate(null)} />
        </div>
    );
}

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const [stats, setStats] = useState<UsageStats | null>(null);
    const [activity, setActivity] = useState<ActivityDay[]>([]);
    const [appVersion, setAppVersion] = useState('');

    useEffect(() => {
        import('@tauri-apps/api/app')
            .then((m) => m.getVersion())
            .then(setAppVersion)
            .catch(() => {});
    }, []);
    const [queryHistory, setQueryHistory] = useState<QueryEntry[]>([]);
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [editingDatasetId, setEditingDatasetId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [isClearing, setIsClearing] = useState(false);

    // Analysis settings
    const [settings, setSettings] = useState({
        defaultAggregation: "SUM",
        showPivotTotals: true,
        maxPreviewRows: 1000,
        cacheResults: true,
    });

    const updateSetting = (key: string, value: any) => {
        setSettings((prev: any) => ({ ...prev, [key]: value }));
        // Persist to localStorage
        localStorage.setItem(`analysis-setting-${key}`, String(value));
    };

    useEffect(() => {
        loadAnalytics();
    }, []);

    const loadAnalytics = async () => {
        try {
            const [statsData, activityData, historyData, favoritesData, datasetsData] = await Promise.all([
                safeInvoke<UsageStats>("get_usage_stats"),
                safeInvoke<ActivityDay[]>("get_activity_heatmap", { days: 90 }),
                safeInvoke<QueryEntry[]>("get_query_history", { limit: 10 }),
                safeInvoke<Favorite[]>("get_favorites"),
                safeInvoke<Dataset[]>("list_datasets"),
            ]);
            setStats(statsData);
            setActivity(activityData);
            setQueryHistory(historyData);
            setFavorites(favoritesData);
            setDatasets(datasetsData);
        } catch (error) {
            console.error("Failed to load analytics:", error);
        }
    };

    const handleDeleteDataset = async (datasetId: number, datasetName: string) => {
        // Confirm before deleting
        const confirmed = await safeConfirm(
            `Are you sure you want to delete "${datasetName}"? This action cannot be undone.`,
            "Delete Dataset"
        );
        if (!confirmed) return;

        setIsDeleting(datasetId);
        try {
            await safeInvoke("delete_dataset", { datasetId });
            setDatasets((prev) => prev.filter((d) => d.id !== datasetId));
        } catch (error) {
            console.error("Failed to delete dataset:", error);
            alert("Failed to delete dataset. Please try again.");
        } finally {
            setIsDeleting(null);
        }
    };

    const handleClearAll = async () => {
        const confirmed = await safeConfirm(
            "Are you sure you want to clear ALL data? This will delete every dataset, report, template, and query history. This action cannot be undone.",
            "Clear All Data"
        );
        if (!confirmed) return;

        setIsClearing(true);
        try {
            await safeInvoke("clear_database");
            setDatasets([]);
            setStats(null);
            setQueryHistory([]);
            setFavorites([]);
            setActivity([]);
        } catch (error) {
            console.error("Failed to clear database:", error);
            alert("Failed to clear database. Please try again.");
        } finally {
            setIsClearing(false);
        }
    };

    const handleStartEditing = (datasetId: number, currentName: string) => {
        setEditingDatasetId(datasetId);
        setEditValue(currentName);
    };

    const handleSaveEdit = async (datasetId: number) => {
        const trimmedName = editValue.trim();
        if (!trimmedName) return;

        try {
            await safeInvoke("rename_dataset", { datasetId, newName: trimmedName });
            setDatasets((prev) =>
                prev.map((d) => (d.id === datasetId ? { ...d, name: trimmedName } : d))
            );
        } catch (error) {
            console.error("Failed to rename dataset:", error);
            alert("Failed to rename dataset. Please try again.");
        } finally {
            setEditingDatasetId(null);
            setEditValue("");
        }
    };

    const handleCancelEdit = () => {
        setEditingDatasetId(null);
        setEditValue("");
    };

    const handleRemoveFavorite = async (id: number) => {
        try {
            await safeInvoke("remove_favorite", { favoriteId: id });
            setFavorites((prev) => prev.filter((f) => f.id !== id));
        } catch (error) {
            console.error("Failed to remove favorite:", error);
        }
    };

    const getActivityLevel = (count: number) => {
        if (count === 0) return "bg-muted/30";
        if (count <= 2) return "bg-accent/30";
        if (count <= 5) return "bg-accent/60";
        return "bg-accent";
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    // Build heatmap data (last 12 weeks)
    const buildHeatmapGrid = () => {
        const weeks = 12;
        const daysPerWeek = 7;
        const grid: { date: string; count: number }[][] = [];

        const activityMap = new Map(activity.map((a) => [a.date, a.count]));
        const today = new Date();

        for (let week = 0; week < weeks; week++) {
            const weekData: { date: string; count: number }[] = [];
            for (let day = 0; day < daysPerWeek; day++) {
                const date = new Date(today);
                date.setDate(date.getDate() - ((weeks - 1 - week) * 7 + (daysPerWeek - 1 - day)));
                const dateStr = date.toISOString().split("T")[0];
                weekData.push({
                    date: dateStr,
                    count: activityMap.get(dateStr) || 0,
                });
            }
            grid.push(weekData);
        }
        return grid;
    };

    const heatmapGrid = buildHeatmapGrid();

    return (
        <div className="flex flex-col h-full bg-background/50 mesh-bg">
            {/* Header */}
            <div className="h-14 px-6 flex items-center gap-3 border-b border-border/50 bg-card/30 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                    <Sun className="w-4 h-4 text-primary" />
                </div>
                <div>
                    <h1 className="text-sm font-semibold">Settings</h1>
                    <p className="text-[10px] text-muted-foreground">Manage your preferences</p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-4xl space-y-10">
                    {/* ── Your Analytics ── */}
                    <section className="space-y-5">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-accent" />
                            <h2 className="text-sm font-medium">Your analytics</h2>
                        </div>

                        {/* Stats Cards */}
                        {stats && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-card/50 border border-border/40 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                        <Database className="w-4 h-4" />
                                        <span className="text-xs">Datasets</span>
                                    </div>
                                    <p className="text-2xl font-semibold text-foreground">{stats.datasets_count}</p>
                                </div>
                                <div className="bg-card/50 border border-border/40 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                        <BarChart3 className="w-4 h-4" />
                                        <span className="text-xs">Reports Run</span>
                                    </div>
                                    <p className="text-2xl font-semibold text-foreground">{stats.reports_run}</p>
                                </div>
                                <div className="bg-card/50 border border-border/40 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                        <Package className="w-4 h-4" />
                                        <span className="text-xs">Total Rows</span>
                                    </div>
                                    <p className="text-2xl font-semibold text-foreground">{stats.total_rows.toLocaleString()}</p>
                                </div>
                            </div>
                        )}

                        {/* Activity Heatmap */}
                        <div className="bg-card/30 border border-border/40 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-medium text-muted-foreground">Activity</h3>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <span>Less</span>
                                    <div className="flex gap-0.5">
                                        <div className="w-3 h-3 rounded-sm bg-muted/30" />
                                        <div className="w-3 h-3 rounded-sm bg-accent/30" />
                                        <div className="w-3 h-3 rounded-sm bg-accent/60" />
                                        <div className="w-3 h-3 rounded-sm bg-accent" />
                                    </div>
                                    <span>More</span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                {heatmapGrid.map((week, weekIdx) => (
                                    <div key={weekIdx} className="flex flex-col gap-1">
                                        {week.map((day, dayIdx) => (
                                            <div
                                                key={`${weekIdx}-${dayIdx}`}
                                                className={cn(
                                                    "w-3 h-3 rounded-sm transition-all hover:ring-1 hover:ring-accent/50",
                                                    getActivityLevel(day.count)
                                                )}
                                                title={`${day.date}: ${day.count} actions`}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Most Used Columns */}
                        {stats && stats.most_used_columns.length > 0 && (
                            <div className="bg-card/30 border border-border/40 rounded-xl p-4">
                                <h3 className="text-xs font-medium text-muted-foreground mb-3">Most Used Columns</h3>
                                <div className="flex flex-wrap gap-2">
                                    {stats.most_used_columns.map((col) => (
                                        <div
                                            key={col.column_name}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-xs"
                                        >
                                            <span className="font-medium">{col.column_name}</span>
                                            <span className="text-muted-foreground">{col.usage_count}x</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ── Recent Reports ── */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-accent" />
                            <h2 className="text-sm font-medium">Recent reports</h2>
                        </div>

                        <div className="bg-card/30 border border-border/40 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                                        <BarChart3 className="w-5 h-5 text-accent" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-semibold text-foreground">{queryHistory.length}</p>
                                        <p className="text-xs text-muted-foreground">reports run</p>
                                    </div>
                                </div>
                                {queryHistory.length > 0 && (
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">
                                            Latest: {formatDate(queryHistory[0].timestamp)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ── Datasets Management ── */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-accent" />
                                <h2 className="text-sm font-medium">Datasets</h2>
                            </div>
                            <span className="text-xs text-muted-foreground">{datasets.length} imported</span>
                        </div>

                        {datasets.length > 0 ? (
                            <div className="bg-card/30 border border-border/40 rounded-xl divide-y divide-border/40">
                                {datasets.map((dataset) => (
                                    <div
                                        key={dataset.id}
                                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <Database className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {editingDatasetId === dataset.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") handleSaveEdit(dataset.id);
                                                                if (e.key === "Escape") handleCancelEdit();
                                                            }}
                                                            className="h-7 text-sm w-full max-w-[350px]"
                                                            autoFocus
                                                        />
                                                        <Button
                                                            onClick={() => handleSaveEdit(dataset.id)}
                                                            size="icon-xs"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-primary hover:bg-primary/10"
                                                        >
                                                            <Check size={14} />
                                                        </Button>
                                                        <Button
                                                            onClick={handleCancelEdit}
                                                            size="icon-xs"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:bg-muted/20"
                                                        >
                                                            <X size={14} />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleStartEditing(dataset.id, dataset.name)}
                                                            className="text-sm font-medium truncate hover:text-primary hover:underline underline-offset-2 transition-colors text-left w-full"
                                                        >
                                                            {dataset.name}
                                                        </button>
                                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                                            <span>{dataset.row_count.toLocaleString()} rows</span>
                                                            <span>·</span>
                                                            <span className="truncate">{dataset.file_origin}</span>
                                                            <span>·</span>
                                                            <span>{formatDate(dataset.created_at)}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {editingDatasetId !== dataset.id && (
                                            <Button
                                                onClick={() => handleDeleteDataset(dataset.id, dataset.name)}
                                                disabled={isDeleting === dataset.id}
                                                variant="ghost"
                                                size="sm"
                                                className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            >
                                                {isDeleting === dataset.id ? (
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                                        Deleting...
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5">
                                                        <Trash2 size={14} />
                                                        Delete
                                                    </span>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-card/30 border border-border/40 rounded-xl p-8 text-center">
                                <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                                <p className="text-sm text-muted-foreground">No datasets yet</p>
                                <p className="text-xs text-muted-foreground/60">Import Excel files from the Data Explorer</p>
                            </div>
                        )}

                        {/* Clear All Data */}
                        {datasets.length > 0 && (
                            <div className="mt-3 flex justify-end">
                                <Button
                                    onClick={handleClearAll}
                                    disabled={isClearing}
                                    variant="outline"
                                    className="border-destructive/30 text-destructive/70 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                                    size="sm"
                                >
                                    {isClearing ? (
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                            Clearing...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5">
                                            <AlertTriangle size={14} />
                                            Clear All Data
                                        </span>
                                    )}
                                </Button>
                            </div>
                        )}
                    </section>
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-accent" />
                            <h2 className="text-sm font-medium">Favorites</h2>
                        </div>

                        {favorites.length > 0 ? (
                            <div className="bg-card/30 border border-border/40 rounded-xl divide-y divide-border/40">
                                {favorites.map((fav) => (
                                    <div key={fav.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                {fav.item_type === "dataset" ? (
                                                    <Database className="w-4 h-4 text-primary" />
                                                ) : (
                                                    <BarChart3 className="w-4 h-4 text-primary" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{fav.name}</p>
                                                <p className="text-[10px] text-muted-foreground capitalize">{fav.item_type}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveFavorite(fav.id)}
                                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-card/30 border border-border/40 rounded-xl p-8 text-center">
                                <Star className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                                <p className="text-sm text-muted-foreground">No favorites yet</p>
                                <p className="text-xs text-muted-foreground/60">Star datasets or reports to quick access them</p>
                            </div>
                        )}
                    </section>

                    {/* ── Analysis Settings ── */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <GitCompare className="w-4 h-4 text-accent" />
                            <h2 className="text-sm font-medium">Analysis</h2>
                        </div>

                        <div className="bg-card/30 border border-border/40 rounded-xl divide-y divide-border/40">
                            {/* Default Aggregation */}
                            <div className="px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Default Aggregation</p>
                                        <p className="text-[10px] text-muted-foreground">Default aggregation for numeric values in pivots</p>
                                    </div>
                                    <Select
                                        value={settings.defaultAggregation || "SUM"}
                                        onValueChange={(v) => updateSetting("defaultAggregation", v)}
                                    >
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SUM">Sum</SelectItem>
                                            <SelectItem value="AVG">Average</SelectItem>
                                            <SelectItem value="COUNT">Count</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Pivot Totals */}
                            <div className="px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Show Grand Totals</p>
                                        <p className="text-[10px] text-muted-foreground">Display row and column totals in pivots</p>
                                    </div>
                                    <button
                                        onClick={() => updateSetting("showPivotTotals", !settings.showPivotTotals)}
                                        className={`w-11 h-6 rounded-full transition-colors ${settings.showPivotTotals ? "bg-primary" : "bg-muted"
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.showPivotTotals ? "translate-x-6" : "translate-x-0.5"
                                            }`} />
                                    </button>
                                </div>
                            </div>

                            {/* Max Rows */}
                            <div className="px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Max Preview Rows</p>
                                        <p className="text-[10px] text-muted-foreground">Maximum rows to display in results</p>
                                    </div>
                                    <Select
                                        value={String(settings.maxPreviewRows || "1000")}
                                        onValueChange={(v) => updateSetting("maxPreviewRows", parseInt(v))}
                                    >
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="100">100</SelectItem>
                                            <SelectItem value="500">500</SelectItem>
                                            <SelectItem value="1000">1,000</SelectItem>
                                            <SelectItem value="5000">5,000</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Cache Results */}
                            <div className="px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Cache Results</p>
                                        <p className="text-[10px] text-muted-foreground">Store query results for faster re-runs</p>
                                    </div>
                                    <button
                                        onClick={() => updateSetting("cacheResults", !settings.cacheResults)}
                                        className={`w-11 h-6 rounded-full transition-colors ${settings.cacheResults ? "bg-primary" : "bg-muted"
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.cacheResults ? "translate-x-6" : "translate-x-0.5"
                                            }`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── App Updates ── */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Download className="w-4 h-4 text-accent" />
                            <h2 className="text-sm font-medium">App Updates</h2>
                        </div>
                        <UpdateSettings />
                    </section>

                    {/* ── Danger Zone ── */}
                    <section className="space-y-4 pt-6 border-t border-destructive/20">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                            <h2 className="text-sm font-medium text-destructive">Danger Zone</h2>
                        </div>

                        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-4">
                            <p className="text-xs text-muted-foreground">
                                Permanently delete all data. This includes every dataset, report template, query history, and favorite. Subgroup data is preserved.
                            </p>
                            <Button
                                onClick={handleClearAll}
                                disabled={isClearing}
                                variant="destructive"
                                size="sm"
                            >
                                {isClearing ? (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                        Clearing...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5">
                                        <Trash2 size={14} />
                                        Clear All Data
                                    </span>
                                )}
                            </Button>
                        </div>
                    </section>

                    {/* ── Appearance ── */}
                    <section className="space-y-3">
                        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Sun className="w-3 h-3" />
                            Appearance
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setTheme("light")}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all",
                                    theme === "light"
                                        ? "border-primary bg-primary/10 text-primary glow-forest"
                                        : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/40"
                                )}
                            >
                                <Sun size={14} />
                                Light
                            </button>
                            <button
                                onClick={() => setTheme("dark")}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-all",
                                    theme === "dark"
                                        ? "border-primary bg-primary/10 text-primary glow-forest"
                                        : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/40"
                                )}
                            >
                                <Moon size={14} />
                                Dark
                            </button>
                        </div>
                    </section>

                    {/* ── About ── */}
                    <section className="space-y-3 pt-4 border-t border-border/50">
                        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">About</h2>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Ledgerly</span>
                            <span className="w-px h-3 bg-border/50" />
                            <span className="font-data">Version {appVersion}</span>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { safeInvoke, safeOpen, safeConfirm } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TyReportGrid } from "@/components/ty-reports/TyReportGrid";
import {
    FileSpreadsheet,
    FolderOpen,
    Loader2,
    Pencil,
    Save,
    Table2,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TyReport {
    id: number;
    name: string;
    original_file_name: string;
    file_path: string;
    table_name: string;
    row_count: number;
    created_at: string;
    updated_at: string;
}

function TyReportsPageContent() {
    const searchParams = useSearchParams();
    const [reports, setReports] = useState<TyReport[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [message, setMessage] = useState<string | null>(null);

    const loadReports = useCallback(async () => {
        try {
            const result = await safeInvoke<TyReport[]>("list_ty_reports");
            setReports(result);
            return result;
        } catch (err) {
            console.error("Failed to load TY reports:", err);
            return [];
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        (async () => {
            const result = await loadReports();
            if (!mounted) return;
            const paramId = searchParams.get("report");
            if (paramId) {
                const found = result.find((r) => r.id === Number(paramId));
                if (found) {
                    setSelectedId(found.id);
                    return;
                }
            }
            if (result.length > 0 && !selectedId) {
                setSelectedId(result[0].id);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [loadReports, searchParams, selectedId]);

    const selectedReport = reports.find((r) => r.id === selectedId) || null;

    const startRenaming = () => {
        if (selectedReport) {
            setDraftName(selectedReport.name);
        }
        setEditingName(true);
    };

    const handleUpload = async () => {
        try {
            const selected = await safeOpen({
                filters: [{ name: "Excel File", extensions: ["xlsx"] }],
                multiple: false,
            });
            if (typeof selected !== "string") return;

            const reportName = selected.split("/").pop()?.replace(".xlsx", "") ?? "TY Report";
            setImporting(true);
            setMessage(null);
            const report = await safeInvoke<TyReport>("import_ty_report", {
                path: selected,
                reportName,
            });
            await loadReports();
            setSelectedId(report.id);
            setMessage(`Imported "${report.name}"`);
        } catch (err) {
            console.error("Import failed:", err);
            setMessage(`Import failed: ${err}`);
        } finally {
            setImporting(false);
        }
    };

    const handleRename = async () => {
        if (!selectedReport || !draftName.trim()) return;
        try {
            await safeInvoke("rename_ty_report", {
                reportId: selectedReport.id,
                name: draftName.trim(),
            });
            await loadReports();
            setEditingName(false);
            setMessage("Report renamed");
        } catch (err) {
            console.error("Rename failed:", err);
            setMessage(`Rename failed: ${err}`);
        }
    };

    const handleDeleteReport = async () => {
        if (!selectedReport) return;
        const confirmed = await safeConfirm(
            `Delete "${selectedReport.name}"? This cannot be undone.`,
            "Delete TY Report"
        );
        if (!confirmed) return;
        try {
            await safeInvoke("delete_ty_report", { reportId: selectedReport.id });
            const updated = await loadReports();
            setSelectedId(updated[0]?.id ?? null);
            setMessage("Report deleted");
        } catch (err) {
            console.error("Delete failed:", err);
            setMessage(`Delete failed: ${err}`);
        }
    };

    const handleExport = async () => {
        if (!selectedReport) return;
        setLoading(true);
        setMessage(null);
        try {
            const path = await safeInvoke<string>("export_ty_report", {
                reportId: selectedReport.id,
            });
            setMessage(`Exported to ${path}`);
        } catch (err) {
            console.error("Export failed:", err);
            setMessage(`Export failed: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full bg-background/50">
            {/* LEFT PANEL - Report list */}
            <aside className="w-80 shrink-0 border-r border-border/50 bg-card flex flex-col overflow-hidden">
                <div className="px-4 pt-4 pb-3 border-b border-border/50">
                    <h1 className="text-sm font-semibold flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-primary" />
                        TY Reports
                    </h1>
                    <p className="text-[10px] text-muted-foreground mb-3">
                        Total Year Reports
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUpload}
                        disabled={importing}
                        className="w-full gap-1.5 border-border/50 hover:border-primary/50"
                    >
                        {importing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Upload className="w-3.5 h-3.5" />
                        )}
                        Upload
                    </Button>
                </div>

                <div className="flex-1 overflow-auto p-2 space-y-1">
                    {reports.map((report) => (
                        <button
                            key={report.id}
                            onClick={() => setSelectedId(report.id)}
                            className={cn(
                                "w-full text-left px-3 py-2.5 rounded-lg transition-colors group",
                                selectedId === report.id
                                    ? "bg-primary/10 border border-primary/20"
                                    : "hover:bg-muted/50 border border-transparent"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span
                                    className={cn(
                                        "text-xs font-medium truncate pr-2",
                                        selectedId === report.id && "text-primary"
                                    )}
                                >
                                    {report.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-data shrink-0">
                                    {report.row_count.toLocaleString()} rows
                                </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground/60 truncate">
                                {report.original_file_name}
                            </div>
                        </button>
                    ))}

                    {reports.length === 0 && !importing && (
                        <div className="text-center py-8 px-4">
                            <FileSpreadsheet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">
                                No TY reports yet
                            </p>
                            <p className="text-[10px] text-muted-foreground/60">
                                Upload an Excel file to get started
                            </p>
                        </div>
                    )}
                </div>
            </aside>

            {/* MAIN PANEL */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {reports.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="w-full max-w-lg animate-fade-in text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                                <FolderOpen className="w-7 h-7 text-primary" />
                            </div>
                            <h2 className="text-lg font-semibold mb-2">
                                Import your first TY report
                            </h2>
                            <p className="text-sm text-muted-foreground mb-6">
                                Upload Total Year Excel files to edit and export them
                            </p>
                            <Button
                                variant="outline"
                                onClick={handleUpload}
                                disabled={importing}
                                className="gap-2 border-border/50 hover:border-primary/50"
                            >
                                {importing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4" />
                                )}
                                Choose file…
                            </Button>
                        </div>
                    </div>
                ) : selectedReport ? (
                    <>
                        {/* Header */}
                        <div className="px-6 py-3 border-b border-border/50 bg-card/20">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    {editingName ? (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={draftName}
                                                onChange={(e) => setDraftName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleRename();
                                                    if (e.key === "Escape") {
                                                        setDraftName(selectedReport.name);
                                                        setEditingName(false);
                                                    }
                                                }}
                                                autoFocus
                                                className="h-8 text-sm w-64"
                                            />
                                            <Button
                                                size="sm"
                                                onClick={handleRename}
                                                className="h-8"
                                            >
                                                <Save className="w-3.5 h-3.5 mr-1" />
                                                Save
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setDraftName(selectedReport.name);
                                                    setEditingName(false);
                                                }}
                                                className="h-8"
                                            >
                                                <X className="w-3.5 h-3.5 mr-1" />
                                                Cancel
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group">
                                            <h2
                                                onClick={startRenaming}
                                                className="text-base font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                                                title="Click to rename"
                                            >
                                                {selectedReport.name}
                                            </h2>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                onClick={startRenaming}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    )}
                                    <span className="text-[11px] text-muted-foreground font-data whitespace-nowrap">
                                        {selectedReport.row_count.toLocaleString()} rows
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExport}
                                        disabled={loading}
                                        className="h-8 gap-1.5 border-border/50"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <FileSpreadsheet className="w-3.5 h-3.5" />
                                        )}
                                        Export
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDeleteReport}
                                        className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete Report
                                    </Button>
                                </div>
                            </div>

                            {message && (
                                <div className="mt-2 text-xs text-muted-foreground animate-fade-in">
                                    {message}
                                </div>
                            )}
                        </div>

                        {/* Grid */}
                        <TyReportGrid
                            key={selectedReport.id}
                            reportId={selectedReport.id}
                            onRowCountChange={async () => {
                                await loadReports();
                            }}
                            onMessage={setMessage}
                        />
                    </>
                ) : null}
            </main>
        </div>
    );
}

export default function TyReportsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-full items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
            }
        >
            <TyReportsPageContent />
        </Suspense>
    );
}

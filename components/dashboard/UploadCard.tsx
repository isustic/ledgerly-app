"use client";

import { useState } from "react";
import { UploadCloud, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useDatasetUpload } from "@/components/dashboard/useDatasetUpload";

interface UploadCardProps {
    compact?: boolean;
    title?: string;
    subtitle?: string;
}

export function UploadCard({
    compact = false,
    title = "Drop your Excel file here",
    subtitle = "or browse from your computer",
}: UploadCardProps) {
    const { pickAndUpload, ingestPath, isIngesting, progress, rowsDone, error, clearError } = useDatasetUpload();
    const [isDragging, setIsDragging] = useState(false);
    const [dropHint, setDropHint] = useState<string | null>(null);

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (!isIngesting) setIsDragging(true);
    };

    const onDragLeave = () => setIsDragging(false);

    const onDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (isIngesting) return;

        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".xlsx")) {
            setDropHint("Only .xlsx files are supported.");
            return;
        }

        // Tauri exposes the native path on dropped files; browsers do not.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const path = (file as any).path as string | undefined;
        if (path) {
            setDropHint(null);
            await ingestPath(path);
        } else {
            setDropHint("Couldn't read that file. Use Browse instead.");
        }
    };

    const message = error ?? dropHint;

    return (
        <div className="space-y-3">
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                aria-busy={isIngesting}
                className={cn(
                    "group relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200",
                    compact ? "p-5" : "p-10",
                    isDragging
                        ? "border-primary bg-primary/10 scale-[1.01]"
                        : "border-primary/30 bg-primary/[0.03] hover:border-primary/60 hover:bg-primary/[0.06]",
                    isIngesting && "pointer-events-none"
                )}
            >
                {/* Soft glow behind the icon */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl"
                />

                <div className={cn("relative flex flex-col items-center text-center", compact ? "gap-3" : "gap-5")}>
                    {/* Icon badge */}
                    <div
                        className={cn(
                            "flex items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform duration-300",
                            compact ? "h-11 w-11" : "h-16 w-16",
                            isDragging && "scale-110 -rotate-3"
                        )}
                    >
                        {isIngesting ? (
                            <Loader2 className={cn(compact ? "h-5 w-5" : "h-7 w-7", "animate-spin")} />
                        ) : (
                            <UploadCloud className={cn(compact ? "h-5 w-5" : "h-7 w-7")} />
                        )}
                    </div>

                    {isIngesting ? (
                        <div className="w-full max-w-md space-y-3" role="status" aria-live="polite">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">Importing your data…</span>
                                <span className="font-data font-semibold text-primary">{progress}%</span>
                            </div>
                            <Progress value={progress} className={compact ? "h-1.5" : "h-2.5"} />
                            <p className="font-data text-xs text-muted-foreground">
                                {rowsDone.toLocaleString()} rows processed
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-1">
                                <p className={cn("font-semibold", compact ? "text-sm" : "text-xl")}>
                                    {isDragging ? "Release to import" : title}
                                </p>
                                <p className="text-sm text-muted-foreground">{subtitle}</p>
                            </div>

                            <Button
                                size={compact ? "sm" : "lg"}
                                onClick={() => {
                                    clearError();
                                    setDropHint(null);
                                    pickAndUpload();
                                }}
                                className="gap-2 shadow-md shadow-primary/20"
                            >
                                <FileSpreadsheet className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                                Browse files
                            </Button>

                            {!compact && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                    <span>Supports</span>
                                    <span className="font-data rounded-md border border-border bg-card px-1.5 py-0.5">.xlsx</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {message && (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{message}</span>
                </div>
            )}
        </div>
    );
}

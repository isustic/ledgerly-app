"use client";

import { translate, translateMessage, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useRef, useCallback } from "react";
import { Upload, FolderOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { safeInvoke, safeOpen, safeListen } from "@/lib/tauri";

type UnlistenFn = () => void;

interface IngestProgress {
    pct: number;
    rows_done: number;
}

interface UploadZoneProps {
    onSuccess: (datasetId: number) => void;
    compact?: boolean;
}

export function UploadZone({ onSuccess, compact = false }: UploadZoneProps) {
    useLanguage();
    const [isDragging, setIsDragging] = useState(false);
    const [isIngesting, setIsIngesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [rowsDone, setRowsDone] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const unlistenRef = useRef<UnlistenFn | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (filePath: string) => {
        setIsIngesting(true);
        setProgress(0);
        setRowsDone(0);
        setError(null);

        // Subscribe to progress events
        unlistenRef.current = await safeListen<IngestProgress>("ingest_progress", (ev) => {
            setProgress(ev.payload.pct);
            setRowsDone(ev.payload.rows_done);
        });

        try {
            const datasetName = filePath.split("/").pop()?.replace(".xlsx", "") ?? "Dataset";
            const result = await safeInvoke<{ id: number }>("ingest_file", {
                path: filePath,
                datasetName,
            });
            setProgress(100);
            setTimeout(() => {
                onSuccess(result.id);
            }, 400);
        } catch (err) {
            setError(String(err));
        } finally {
            setIsIngesting(false);
            unlistenRef.current?.();
        }
    }, [onSuccess]);

    // Upload button: native OS file picker
    const handleOpenDialog = async () => {
        const selected = await safeOpen({
            filters: [{ name: "Excel File", extensions: ["xlsx"] }],
            multiple: false,
        });
        if (typeof selected === "string") {
            await handleFile(selected);
        }
    };

    // Drag-and-drop handlers
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const onDragLeave = () => setIsDragging(false);
    const onDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (!file || !file.name.endsWith(".xlsx")) {
            setError("Only .xlsx files are accepted.");
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const path = (file as any).path as string | undefined;
        if (path) {
            await handleFile(path);
        } else {
            setError("Could not read file path. Use the Import button.");
        }
    };

    if (compact) {
        return (
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenDialog}
                    disabled={isIngesting}
                    className="h-8 gap-1.5 border-border/50 hover:border-primary/50"
                >
                    <FolderOpen size={13} />
                    {translate("Import…")}</Button>
                {isIngesting && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Sparkles size={12} className="animate-pulse" />
                        {progress}%
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Drop zone */}
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                    "relative overflow-hidden rounded-xl border-2 p-8 transition-all duration-300",
                    isDragging
                        ? "border-primary bg-primary/10"
                        : "border-border/40 hover:border-border bg-muted/20",
                    isIngesting && "pointer-events-none opacity-60"
                )}
            >
                {/* Background gradient mesh */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

                <div className="relative flex flex-col items-center justify-center gap-4">
                    {/* Animated icon */}
                    <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                        isDragging
                            ? "bg-primary/20 scale-110"
                            : "bg-muted/50"
                    )}>
                        <Upload className={cn(
                            "w-6 h-6 transition-colors",
                            isDragging ? "text-primary" : "text-muted-foreground"
                        )} />
                    </div>

                    <div className="text-center space-y-1">
                        <p className="text-sm font-medium">{translate("Drag your excel file here")}</p>
                        <p className="text-xs text-muted-foreground">{translate("or browse to select an .xlsx file")}</p>
                    </div>

                    <Button
                        variant="outline"
                        onClick={handleOpenDialog}
                        disabled={isIngesting}
                        className="gap-2 border-border/50 hover:border-primary/50 hover:bg-primary/5"
                    >
                        <FolderOpen size={14} />
                        {translate("Choose file…")}</Button>

                    {/* File format hint */}
                    <div className="flex gap-1.5 text-[10px] text-muted-foreground/60">
                        <span className="px-1.5 py-0.5 rounded bg-background/40">.xlsx</span>
                        <span className="px-1.5 py-0.5 rounded bg-background/40">.xls</span>
                    </div>
                </div>
            </div>

            {/* Progress */}
            {isIngesting && (
                <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                            <Sparkles size={12} className="animate-pulse text-primary" />
                            {translate("Importing data…")}</span>
                        <span className="font-data text-primary">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground text-center font-data">
                        {rowsDone.toLocaleString(getLocale())} {" "}{translate("rows processed")}</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <p className="text-sm text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 flex items-start gap-2">
                    <span className="shrink-0">⚠</span>
                    <span>{translateMessage(error)}</span>
                </p>
            )}
        </div>
    );
}

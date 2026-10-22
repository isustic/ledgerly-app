"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { ReactNode } from "react";
import Link from "next/link";
import { translate, translateMessage } from "@/lib/i18n";
import { ArrowLeft, AlertCircleIcon, LoaderIcon, type LucideIcon } from "lucide-react";
import { DatasetSelector } from "@/components/analysis/DatasetSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ReportShellProps {
    icon: LucideIcon;
    title: string;
    description: string;
    datasetId: number | null;
    onDatasetChange: (id: number) => void;
    isLoadingColumns?: boolean;
    error?: string | null;
    onRetry?: () => void;
    /** Hide the single-dataset picker (for reports that pick their own datasets). */
    hideDatasetSelector?: boolean;
    /** Left-hand builder panel. Rendered only once a dataset is selected. */
    sidebar?: ReactNode;
    /** Right-hand results area. */
    children?: ReactNode;
}

export function ReportShell({
    icon: Icon,
    title,
    description,
    datasetId,
    onDatasetChange,
    isLoadingColumns = false,
    error,
    onRetry,
    hideDatasetSelector = false,
    sidebar,
    children,
}: ReportShellProps) {
    useLanguage();
    const awaitingDataset = !hideDatasetSelector && datasetId === null;

    return (
        <div className="flex flex-col h-full bg-background">
            <header className="shrink-0 border-b border-border/60 bg-card">
                <div className="flex items-center gap-3 px-6 py-3">
                    <Link href="/analysis" aria-label={translate("Back to Analysis")}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-base font-semibold tracking-tight">{translate(title)}</h1>
                        <p className="truncate text-xs text-muted-foreground">{translate(description)}</p>
                    </div>
                    {isLoadingColumns && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                            <span>{translate("Loading columns...")}</span>
                        </div>
                    )}
                    {!hideDatasetSelector && <DatasetSelector value={datasetId} onChange={onDatasetChange} />}
                </div>
            </header>

            {error && (
                <div className="shrink-0 px-6 pt-4">
                    <Alert variant="destructive" className="py-2.5">
                        <AlertCircleIcon className="h-4 w-4" />
                        <AlertDescription className="flex items-center justify-between gap-4">
                            <span>{translateMessage(error)}</span>
                            {onRetry && (
                                <Button variant="outline" size="sm" onClick={onRetry} className="bg-background">
                                    {translate("Try again")}
                                </Button>
                            )}
                        </AlertDescription>
                    </Alert>
                </div>
            )}

            {awaitingDataset ? (
                <div className="flex flex-1 items-center justify-center p-8">
                    <div className="flex max-w-sm flex-col items-center text-center">
                        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Icon className="h-8 w-8" />
                        </div>
                        <h2 className="text-lg font-semibold tracking-tight">{translate("Start with a dataset")}</h2>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                            {translate("Choose a dataset to begin building your analysis.")}
                        </p>
                        <div className="mt-6">
                            <DatasetSelector value={datasetId} onChange={onDatasetChange} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 overflow-hidden">
                    {sidebar && (
                        <aside className="flex w-80 shrink-0 flex-col border-r border-border/60 bg-card">
                            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {translate("Configuration")}
                                </span>
                            </div>
                            <div className="flex-1 space-y-4 overflow-y-auto p-4">{sidebar}</div>
                        </aside>
                    )}
                    <main className="flex min-w-0 flex-1 flex-col overflow-auto">{children}</main>
                </div>
            )}
        </div>
    );
}

interface ReportEmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    loading?: boolean;
}

/** Centered placeholder for the results pane: idle hint or loading spinner. */
export function ReportEmptyState({ icon: Icon, title, description, loading = false }: ReportEmptyStateProps) {
    useLanguage();
    return (
        <div className="flex flex-1 items-center justify-center p-8">
            <div className="flex max-w-xs flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    {loading ? <LoaderIcon className="h-5 w-5 animate-spin text-primary" /> : <Icon className="h-5 w-5" />}
                </div>
                <h3 className="text-sm font-semibold">{translate(title)}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{translate(description)}</p>
            </div>
        </div>
    );
}

"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { setLastOpenedDataset } from "@/lib/dataset-tracking";
import { invoke } from "@tauri-apps/api/core";
import { UploadZone } from "@/components/Upload/UploadZone";
import { Badge } from "@/components/ui/badge";
import { Database, FileSpreadsheet, Clock, FolderOpen, Table2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/Upload/DataTable";

interface Dataset {
    id: number;
    name: string;
    file_origin: string;
    table_name: string;
    row_count: number;
    created_at: string;
}

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(getLocale(), {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const fileName = (path: string) => path.split(/[\\/]/).pop() || path;

function UploadPageContent() {
    useLanguage();
    const searchParams = useSearchParams();
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);

    const loadDatasets = useCallback(async () => {
        const ds = await invoke<Dataset[]>("list_datasets");
        setDatasets(ds);
        if (ds.length > 0 && !activeDataset) {
            const firstDataset = ds[0];
            setActiveDataset(firstDataset);
            setLastOpenedDataset(firstDataset.id);
        }
    }, [activeDataset]);

    useEffect(() => {
        loadDatasets();
    }, []);

    useEffect(() => {
        // Handle dataset pre-selection from URL
        const datasetId = searchParams.get("dataset");
        if (datasetId && datasets.length > 0) {
            const found = datasets.find((d) => d.id === Number(datasetId));
            if (found) {
                setActiveDataset(found);
                setLastOpenedDataset(found.id);
            }
        }
    }, [datasets, searchParams]);

    if (datasets.length === 0) {
        return (
            <div className="flex h-full items-center justify-center bg-background p-6">
                <div className="w-full max-w-lg animate-fade-in rounded-xl border border-border bg-card p-8 shadow-sm">
                    <div className="mb-6 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                            <FileSpreadsheet className="h-6 w-6" />
                        </div>
                        <h1 className="mb-1.5 text-xl font-semibold tracking-tight">{translate("Import your first Excel file")}</h1>
                        <p className="text-sm text-muted-foreground">
                            {translate("Your rows show up here as a searchable table, ready for reports.")}</p>
                    </div>
                    <UploadZone onSuccess={loadDatasets} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-background">
            {/* Header */}
            <header className="flex flex-col gap-4 border-b border-border bg-card px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                        <Database className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-primary">{translate("Raw data")}</p>
                        <h1 className="truncate text-xl font-semibold tracking-tight">
                            {activeDataset?.name ?? translate("No dataset selected")}
                        </h1>
                        {activeDataset && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <Badge variant="secondary" className="font-data">
                                    <Table2 className="h-3 w-3" />
                                    {activeDataset.row_count.toLocaleString(getLocale())} {" "}{translate("rows")}</Badge>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {translate("Imported")}{" "}{formatDate(activeDataset.created_at)}
                                </span>
                                <span className="flex min-w-0 items-center gap-1">
                                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{fileName(activeDataset.file_origin)}</span>
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Select
                        value={String(activeDataset?.id ?? "")}
                        onValueChange={(value) => {
                            const selected = datasets.find((ds) => ds.id === Number(value));
                            if (selected) {
                                setActiveDataset(selected);
                                setLastOpenedDataset(selected.id);
                            }
                        }}
                    >
                        <SelectTrigger className="w-[260px]" aria-label={translate("Dataset")}>
                            <SelectValue placeholder={translate("Select dataset")} />
                        </SelectTrigger>
                        <SelectContent>
                            {datasets.map((ds) => (
                                <SelectItem key={ds.id} value={String(ds.id)}>
                                    {ds.name} ({(ds.row_count / 1000).toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{translate("k rows)")}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <UploadZone onSuccess={loadDatasets} compact />
                </div>
            </header>

            {/* Table card */}
            {activeDataset && (
                <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <DataTable
                            key={activeDataset.id}
                            datasetId={activeDataset.id}
                            datasetName={activeDataset.name}
                            rowCount={activeDataset.row_count}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function UploadPage() {
    useLanguage();
    return (
        <Suspense fallback={
            <div className="p-8" aria-busy="true" aria-label={translate("Loading")}>
                <div className="h-8 w-48 rounded-md bg-muted" />
            </div>
        }>
            <UploadPageContent />
        </Suspense>
    );
}

"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { setLastOpenedDataset } from "@/lib/dataset-tracking";
import { invoke } from "@tauri-apps/api/core";
import { UploadZone } from "@/components/Upload/UploadZone";
import { Database, FileSpreadsheet } from "lucide-react";
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

function UploadPageContent() {
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

    return (
        <div className="flex flex-col h-full bg-background/50 mesh-bg">
            {/* Header */}
            <div className="h-14 px-6 flex items-center justify-between gap-4 border-b border-border/50 bg-card">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Database className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold">Data explorer</h1>
                        <p className="text-[10px] text-muted-foreground">
                            {activeDataset ? `${activeDataset.row_count.toLocaleString()} rows · ${activeDataset.name}` : "No dataset"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Dataset</span>
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
                        <SelectTrigger size="sm" className="w-[200px]">
                            <SelectValue placeholder="Select dataset" />
                        </SelectTrigger>
                        <SelectContent>
                            {datasets.map((ds) => (
                                <SelectItem key={ds.id} value={String(ds.id)}>
                                    {ds.name} ({(ds.row_count / 1000).toFixed(1)}k rows)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Upload zone or table */}
            {datasets.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="w-full max-w-lg animate-fade-in">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                                <FileSpreadsheet className="w-7 h-7 text-primary" />
                            </div>
                            <h2 className="text-lg font-semibold mb-2">Import your first excel file</h2>
                            <p className="text-sm text-muted-foreground">
                                Upload Excel files to start analyzing data
                            </p>
                        </div>
                        <UploadZone onSuccess={loadDatasets} />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col flex-1 min-h-0">
                    {/* Data Table */}
                    {activeDataset && (
                        <DataTable
                            datasetId={activeDataset.id}
                            datasetName={activeDataset.name}
                            rowCount={activeDataset.row_count}
                            uploadZone={<UploadZone onSuccess={loadDatasets} compact />}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default function UploadPage() {
    return (
        <Suspense fallback={
            <div className="p-8" aria-busy="true" aria-label="Loading">
                <div className="h-8 w-48 rounded-md bg-muted" />
            </div>
        }>
            <UploadPageContent />
        </Suspense>
    );
}

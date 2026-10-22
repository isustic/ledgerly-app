"use client";

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LoaderIcon, AlertCircleIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DatasetSelector } from "@/components/analysis/DatasetSelector";
import { FormulaEditor } from "@/components/analysis/formula/FormulaEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function FormulaPage() {
    const [datasetId, setDatasetId] = useState<number | null>(null);
    const [columns, setColumns] = useState<string[]>([]);
    const [isLoadingColumns, setIsLoadingColumns] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDatasetChange = async (id: number) => {
        setDatasetId(id);
        setIsLoadingColumns(true);
        setError(null);

        try {
            const cols = await invoke<{ name: string }[]>("get_columns", { datasetId: id });
            setColumns(cols.map((c) => c.name));
        } catch (err) {
            console.error("Failed to load columns:", err);
            setError("Failed to load columns. Please try selecting the dataset again.");
            setColumns([]);
        } finally {
            setIsLoadingColumns(false);
        }
    };

    const handleRetry = () => {
        setError(null);
        if (datasetId) {
            handleDatasetChange(datasetId);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background/50 mesh-bg">
            <div className="h-14 px-6 flex items-center justify-between border-b border-border/50 bg-card">
                <div className="flex items-center gap-3">
                    <Link href="/analysis">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <DatasetSelector value={datasetId} onChange={handleDatasetChange} />
                    {isLoadingColumns && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <LoaderIcon className="h-4 w-4 animate-spin" />
                            <span>Loading columns...</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircleIcon className="h-4 w-4" />
                        <AlertDescription className="flex items-center justify-between">
                            <span>{error}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRetry}
                                className="ml-4 bg-background"
                            >
                                Try again
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {datasetId ? (
                    isLoadingColumns ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-3">
                                <LoaderIcon className="h-8 w-8 text-primary animate-spin" />
                                <p className="text-sm text-muted-foreground">Loading columns...</p>
                            </div>
                        </div>
                    ) : (
                        <FormulaEditor datasetId={datasetId} columns={columns} />
                    )
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-sm text-muted-foreground">Select a dataset to begin</p>
                    </div>
                )}
            </div>
        </div>
    );
}

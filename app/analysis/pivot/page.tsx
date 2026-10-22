"use client";

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LoaderIcon, AlertCircleIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DatasetSelector } from "@/components/analysis/DatasetSelector";
import { PivotBuilder, PivotConfig } from "@/components/analysis/pivot/PivotBuilder";
import { ResultsGrid } from "@/components/analysis/ResultsGrid";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Column {
    name: string;
    col_type: string;
    display_order: number;
}

interface PivotResult {
    rows: Array<{ cells: string[] }>;
    columns: string[];
}

export default function PivotPage() {
    const [datasetId, setDatasetId] = useState<number | null>(null);
    const [columns, setColumns] = useState<string[]>([]);
    const [results, setResults] = useState<Record<string, unknown>[]>([]);
    const [resultColumns, setResultColumns] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingColumns, setIsLoadingColumns] = useState(false);

    const handleDatasetChange = async (id: number) => {
        setDatasetId(id);
        setIsLoadingColumns(true);
        setError(null);
        setResults([]);
        setResultColumns([]);

        try {
            const cols = await invoke<Column[]>("get_columns", { datasetId: id });
            setColumns(cols.map((c: Column) => c.name));
        } catch (err) {
            console.error("Failed to load columns:", err);
            setError("Failed to load columns. Please try selecting the dataset again.");
            setColumns([]);
        } finally {
            setIsLoadingColumns(false);
        }
    };

    const handleRun = async (config: PivotConfig) => {
        if (!datasetId) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await invoke<PivotResult>("run_pivot_query", {
                datasetId,
                config
            });
            // Transform backend format { cells: [...] } to { col1: val1, col2: val2, ... }
            const transformedRows = result.rows.map((row) => {
                const obj: Record<string, unknown> = {};
                result.columns.forEach((col, index) => {
                    obj[col] = row.cells[index] ?? "";
                });
                return obj;
            });
            setResults(transformedRows);
            setResultColumns(result.columns);
        } catch (err) {
            console.error("Pivot query failed:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(`Failed to run pivot query: ${errorMessage}. Please check your configuration and try again.`);
            setResults([]);
            setResultColumns([]);
        } finally {
            setIsLoading(false);
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
            {/* Compact Header */}
            <div className="h-12 px-4 flex items-center gap-3 border-b border-border/50 bg-card shrink-0">
                <Link href="/analysis">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                </Link>
                <DatasetSelector value={datasetId} onChange={handleDatasetChange} />
                {isLoadingColumns && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <LoaderIcon className="h-3 w-3 animate-spin" />
                        <span>Loading...</span>
                    </div>
                )}
            </div>

            {/* Error Alert */}
            {error && (
                <div className="px-4 pt-3 shrink-0">
                    <Alert variant="destructive" className="py-2 px-3">
                        <AlertCircleIcon className="h-3.5 w-3.5" />
                        <AlertDescription className="flex items-center justify-between text-xs">
                            <span>{error}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRetry}
                                className="ml-4 h-6 px-2 bg-background"
                            >
                                Try again
                            </Button>
                        </AlertDescription>
                    </Alert>
                </div>
            )}

            {/* Main Content: Side-by-Side Layout */}
            {!datasetId ? (
                <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Select a dataset to begin</p>
                </div>
            ) : (
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left Side: Pivot Builder */}
                    <div className="w-72 shrink-0 border-r border-border/50 bg-card/20 flex flex-col">
                        <div className="p-3 space-y-3 overflow-y-auto flex-1">
                            <PivotBuilder
                                columns={columns}
                                onRun={handleRun}
                                onSave={() => {}}
                                isLoading={isLoading}
                                compact
                            />
                        </div>
                    </div>

                    {/* Right Side: Results */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-2">
                                    <LoaderIcon className="h-6 w-6 text-primary animate-spin" />
                                    <p className="text-xs text-muted-foreground">Running pivot query...</p>
                                </div>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="flex-1 overflow-auto p-3">
                                <ResultsGrid data={results} columns={resultColumns} />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-xs text-muted-foreground">
                                    Configure your pivot and click Run to see results
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

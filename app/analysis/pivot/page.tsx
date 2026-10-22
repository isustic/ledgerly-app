"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Table } from "lucide-react";
import { ReportShell, ReportEmptyState } from "@/components/analysis/ReportShell";
import { PivotBuilder, PivotConfig } from "@/components/analysis/pivot/PivotBuilder";
import { ResultsGrid } from "@/components/analysis/ResultsGrid";

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
    useLanguage();
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

    const hasResults = results.length > 0;

    return (
        <ReportShell
            icon={Table}
            title={translate("Pivot Tables")}
            description={translate("Multi-dimensional analysis with drag-and-drop")}
            datasetId={datasetId}
            onDatasetChange={handleDatasetChange}
            isLoadingColumns={isLoadingColumns}
            error={error}
            onRetry={handleRetry}
            sidebar={
                <PivotBuilder
                    columns={columns}
                    onRun={handleRun}
                    onSave={() => {}}
                    isLoading={isLoading}
                    compact
                />
            }
        >
            {isLoading ? (
                <ReportEmptyState icon={Table} title={translate("Running pivot query...")} description="This usually takes a moment." loading />
            ) : hasResults ? (
                <div className="flex-1 overflow-auto p-6">
                    <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            {results.length.toLocaleString(getLocale())} {translate("rows")}
                        </span>
                    </div>
                    <ResultsGrid data={results} columns={resultColumns} />
                </div>
            ) : (
                <ReportEmptyState
                    icon={Table}
                    title="No results yet"
                    description="Configure your pivot and click Run to see results."
                />
            )}
        </ReportShell>
    );
}

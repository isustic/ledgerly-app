"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Calculator } from "lucide-react";
import { ReportShell, ReportEmptyState } from "@/components/analysis/ReportShell";
import { FormulaEditor } from "@/components/analysis/formula/FormulaEditor";

export default function FormulaPage() {
    useLanguage();
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
        <ReportShell
            icon={Calculator}
            title={translate("Formula")}
            description={translate("Create calculated fields")}
            datasetId={datasetId}
            onDatasetChange={handleDatasetChange}
            isLoadingColumns={isLoadingColumns}
            error={error}
            onRetry={handleRetry}
        >
            {datasetId !== null && (
                <div className="flex-1 p-6">
                    {isLoadingColumns ? (
                        <ReportEmptyState icon={Calculator} title={translate("Loading columns...")} description="Preparing your dataset." loading />
                    ) : (
                        <FormulaEditor datasetId={datasetId} columns={columns} />
                    )}
                </div>
            )}
        </ReportShell>
    );
}

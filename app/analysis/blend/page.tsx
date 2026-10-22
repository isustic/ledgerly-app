"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GitMerge } from "lucide-react";
import { ReportShell, ReportEmptyState } from "@/components/analysis/ReportShell";
import { BlendBuilder } from "@/components/analysis/blend/BlendBuilder";

interface Dataset {
    id: number;
    name: string;
    table_name: string;
}

export default function BlendPage() {
    useLanguage();
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadDatasets = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await invoke<Dataset[]>("list_datasets");
            setDatasets(result);
        } catch (err) {
            console.error("Failed to load datasets:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(`Failed to load datasets: ${errorMessage}. Please try again.`);
            setDatasets([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDatasets();
    }, []);

    return (
        <ReportShell
            icon={GitMerge}
            title={translate("Blend Datasets")}
            description={translate("Join multiple datasets")}
            datasetId={null}
            onDatasetChange={() => {}}
            isLoadingColumns={isLoading}
            error={error}
            onRetry={loadDatasets}
            hideDatasetSelector
        >
            <div className="flex-1 p-6">
                {isLoading ? (
                    <ReportEmptyState icon={GitMerge} title={translate("Loading datasets...")} description="Fetching your datasets." loading />
                ) : datasets.length >= 2 ? (
                    <BlendBuilder datasets={datasets} onError={(err) => setError(err)} />
                ) : (
                    <ReportEmptyState
                        icon={GitMerge}
                        title={`${datasets.length} ${translate("available.")}`}
                        description="You need at least 2 datasets to blend."
                    />
                )}
            </div>
        </ReportShell>
    );
}

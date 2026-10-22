"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import { WelcomeDashboard } from "@/components/dashboard/WelcomeDashboard";
import { ReturningDashboard } from "@/components/dashboard/ReturningDashboard";
import { safeInvoke } from "@/lib/tauri";

interface Dataset {
    id: number;
    name: string;
    file_origin: string;
    table_name: string;
    row_count: number;
    created_at: string;
}

export default function HomePage() {
    useLanguage();
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDatasets();
    }, []);

    const loadDatasets = async () => {
        try {
            const data = await safeInvoke<Dataset[]>("list_datasets");
            setDatasets(data);
        } catch (err) {
            // Not in Tauri or command failed - show welcome screen
            console.log("Running in browser mode or command failed:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-4 p-8" aria-busy="true" aria-label={translate("Loading")}>
                <div className="h-8 w-48 rounded-md bg-muted" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className="h-24 rounded-lg border border-border bg-muted/50" />
                    ))}
                </div>
            </div>
        );
    }

    if (datasets.length === 0) {
        return <WelcomeDashboard />;
    }

    return <ReturningDashboard datasets={datasets} />;
}

"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LoaderIcon, AlertCircleIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BlendBuilder } from "@/components/analysis/blend/BlendBuilder";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Dataset {
    id: number;
    name: string;
    table_name: string;
}

export default function BlendPage() {
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

    const handleRetry = () => {
        loadDatasets();
    };

    return (
        <div className="flex flex-col h-full bg-background/50 mesh-bg">
            <div className="h-14 px-6 flex items-center justify-between border-b border-border/50 bg-card">
                <div className="flex items-center gap-2">
                    <Link href="/analysis">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-sm font-semibold">Blend Datasets</h1>
                    {isLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <LoaderIcon className="h-4 w-4 animate-spin" />
                            <span>Loading datasets...</span>
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

                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-3">
                            <LoaderIcon className="h-8 w-8 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Loading datasets...</p>
                        </div>
                    </div>
                ) : datasets.length >= 2 ? (
                    <BlendBuilder datasets={datasets} onError={(err) => setError(err)} />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-sm text-muted-foreground">
                            You need at least 2 datasets to blend. {datasets.length} available.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Home, Upload, BarChart3, FileSpreadsheet, Clock, Sparkles, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { safeInvoke, safeOpen, safeListen } from "@/lib/tauri";

type UnlistenFn = () => void;

interface IngestProgress {
    pct: number;
    rows_done: number;
}

export function WelcomeDashboard() {
    const router = useRouter();
    const [isIngesting, setIsIngesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [rowsDone, setRowsDone] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const unlistenRef = useRef<UnlistenFn | null>(null);

    const handleFileUpload = useCallback(async () => {
        setError(null);
        const selected = await safeOpen({
            filters: [{ name: "Excel File", extensions: ["xlsx"] }],
            multiple: false,
        });

        if (typeof selected === "string") {
            setIsIngesting(true);
            setProgress(0);
            setRowsDone(0);

            // Subscribe to progress events
            unlistenRef.current = await safeListen<IngestProgress>("ingest_progress", (ev) => {
                setProgress(ev.payload.pct);
                setRowsDone(ev.payload.rows_done);
            });

            try {
                const datasetName = selected.split("/").pop()?.replace(".xlsx", "") ?? "Dataset";
                const result = await safeInvoke<{ id: number }>("ingest_file", {
                    path: selected,
                    datasetName,
                });
                setProgress(100);

                // Navigate to upload page with the new dataset
                router.push(`/upload?dataset=${result.id}`);
            } catch (err) {
                setError(String(err));
                setIsIngesting(false);
                unlistenRef.current?.();
            }
        }
    }, [router]);

    const features = [
        {
            icon: Upload,
            title: "Upload Excel Files",
            description: "Drag & drop your .xlsx files to import and analyze your data"
        },
        {
            icon: BarChart3,
            title: "Build Custom Reports",
            description: "Create multi-step reports with grouping, calculations, and filters"
        },
        {
            icon: FileSpreadsheet,
            title: "EPro Analysis",
            description: "Generate specialized EPro reports with agent tracking"
        },
        {
            icon: Clock,
            title: "Track History",
            description: "Browse and analyze past datasets organized by date"
        }
    ];

    return (
        <div className="bg-background">
            <div className="container mx-auto px-4 py-16">
                {/* Hero Section */}
                <div className="text-center mb-16">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                            <Home className="w-10 h-10 text-primary-foreground" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        Welcome to Data Analyzer
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Upload, analyze, and aggregate your Excel data with powerful reporting tools
                    </p>
                </div>

                {/* Upload CTA */}
                <div className="flex flex-col items-center mb-16">
                    <Button
                        size="lg"
                        onClick={handleFileUpload}
                        disabled={isIngesting}
                        className="px-8 py-6 text-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    >
                        <FolderOpen className="w-5 h-5 mr-2" />
                        Upload Your First Dataset
                    </Button>

                    {/* Progress */}
                    {isIngesting && (
                        <div className="w-full max-w-md mt-6 space-y-3 animate-fade-in">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Sparkles size={14} className="animate-pulse text-primary" />
                                    Importing data…
                                </span>
                                <span className="font-data text-primary">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                            <p className="text-xs text-muted-foreground text-center font-data">
                                {rowsDone.toLocaleString()} rows processed
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="mt-4 text-sm text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-start gap-2 max-w-md">
                            <span className="shrink-0">⚠</span>
                            <span>{error}</span>
                        </p>
                    )}
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    {features.map((feature, index) => (
                        <Card
                            key={index}
                            className="border-border/50 bg-card hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
                        >
                            <CardContent className="p-6">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                        <feature.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}

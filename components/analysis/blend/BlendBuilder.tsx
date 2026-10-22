"use client";

import { translate, translateMessage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Database, Plus, Trash2, Play, Save, LoaderIcon, AlertCircleIcon, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BlendBuilderProps {
    datasets: Array<{ id: number; name: string; table_name: string }>;
    onError?: (error: string | null) => void;
}

export function BlendBuilder({ datasets, onError }: BlendBuilderProps) {
    useLanguage();
    const [selectedDatasets, setSelectedDatasets] = useState<number[]>([]);
    const [joinType, setJoinType] = useState<"inner" | "left" | "right" | "full">("inner");
    const [matches, setMatches] = useState<Array<{ left: string; right: string }>>([]);
    const [results, setResults] = useState<Record<string, unknown>[]>([]);
    const [resultColumns, setResultColumns] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddDataset = (id: number) => {
        if (selectedDatasets.length < 4 && !selectedDatasets.includes(id)) {
            setSelectedDatasets([...selectedDatasets, id]);
            setError(null);
        }
    };

    const handleRemoveDataset = (id: number) => {
        setSelectedDatasets(selectedDatasets.filter((d) => d !== id));
    };

    const handleAddMatch = () => {
        setMatches([...matches, { left: "", right: "" }]);
    };

    const handleRun = async () => {
        if (selectedDatasets.length < 2) {
            const errorMsg = "Please select at least 2 datasets";
            setError(errorMsg);
            if (onError) onError(errorMsg);
            return;
        }

        setIsLoading(true);
        setError(null);
        if (onError) onError(null);

        try {
            const result = await invoke<{ rows: Record<string, unknown>[]; columns: string[] }>("run_blend_query", {
                config: {
                    datasetIds: selectedDatasets,
                    joinType,
                    matches: matches.filter((m) => m.left && m.right),
                },
            });
            setResults(result.rows);
            setResultColumns(result.columns);
        } catch (err) {
            console.error("Blend query failed:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            const fullError = `Blend failed: ${errorMessage}`;
            setError(fullError);
            if (onError) onError(fullError);
            setResults([]);
            setResultColumns([]);
        } finally {
            setIsLoading(false);
        }
    };

    const selectedDatasetObjs = datasets.filter((d) => selectedDatasets.includes(d.id));

    const cardClass = "rounded-xl border border-border/60 bg-card p-4 shadow-sm";
    const sectionLabel = "mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
    const joinHints: Record<typeof joinType, string> = {
        inner: "Only keep rows that match in all datasets",
        left: "Keep all rows from the first dataset",
        right: "Keep all rows from the last dataset",
        full: "Keep all rows from all datasets",
    };

    return (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
            {/* Dataset Selection */}
            <div className="space-y-4">
                <div className={cardClass}>
                    <h4 className={sectionLabel}>
                        <span>{translate("Datasets")}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] normal-case tracking-normal">
                            {selectedDatasets.length}/4
                        </span>
                    </h4>
                    <div className="space-y-1.5">
                        {datasets.map((ds) => {
                            const picked = selectedDatasets.includes(ds.id);
                            return (
                                <button
                                    key={ds.id}
                                    onClick={() => handleAddDataset(ds.id)}
                                    disabled={picked || isLoading}
                                    className="flex w-full items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                        <Database className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-medium">{ds.name}</span>
                                    {picked && <Check className="h-3.5 w-3.5 text-primary" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {selectedDatasetObjs.length > 0 && (
                    <div className={cardClass}>
                        <h4 className={sectionLabel}>{translate("Selected")}</h4>
                        <div className="space-y-1.5">
                            {selectedDatasetObjs.map((ds, i) => (
                                <div
                                    key={ds.id}
                                    className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
                                >
                                    <span className="font-data flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                                        {i + 1}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-medium">{ds.name}</span>
                                    <button
                                        onClick={() => handleRemoveDataset(ds.id)}
                                        disabled={isLoading}
                                        aria-label={translate("Remove")}
                                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Join Configuration + Results */}
            <div className="min-w-0 space-y-5">
                <div className={cardClass}>
                    <h4 className={sectionLabel}>{translate("Join Type")}</h4>
                    <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted/60 p-1 sm:grid-cols-4">
                        {(["inner", "left", "right", "full"] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setJoinType(type)}
                                disabled={isLoading}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors disabled:opacity-50 ${
                                    joinType === type
                                        ? "bg-card text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {translate(type)} {translate("join")}
                            </button>
                        ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{translate(joinHints[joinType])}</p>
                </div>

                <div className={cardClass}>
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{translate("Match On")}</h4>
                        <Button size="sm" variant="outline" onClick={handleAddMatch} disabled={isLoading} className="h-7 gap-1 px-2 text-xs">
                            <Plus className="h-3.5 w-3.5" />
                            {translate("Add match")}
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {matches.map((match, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder={translate("Column from first dataset")}
                                    value={match.left}
                                    onChange={(e) => {
                                        const newMatches = [...matches];
                                        newMatches[i].left = e.target.value;
                                        setMatches(newMatches);
                                    }}
                                    disabled={isLoading}
                                    className="h-9 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-primary disabled:opacity-50"
                                />
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">=</span>
                                <input
                                    type="text"
                                    placeholder={translate("Column from second dataset")}
                                    value={match.right}
                                    onChange={(e) => {
                                        const newMatches = [...matches];
                                        newMatches[i].right = e.target.value;
                                        setMatches(newMatches);
                                    }}
                                    disabled={isLoading}
                                    className="h-9 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-primary disabled:opacity-50"
                                />
                                <button
                                    onClick={() => setMatches(matches.filter((_, j) => j !== i))}
                                    disabled={isLoading}
                                    aria-label={translate("Remove")}
                                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                        {matches.length === 0 && (
                            <div className="rounded-lg border-2 border-dashed border-border/70 py-5 text-center text-xs text-muted-foreground">
                                {translate("No matches defined. Add a match to join datasets.")}
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircleIcon className="h-4 w-4" />
                        <AlertDescription>{translateMessage(error)}</AlertDescription>
                    </Alert>
                )}

                <div className="flex gap-2">
                    <Button onClick={handleRun} disabled={selectedDatasets.length < 2 || isLoading} className="h-9">
                        {isLoading ? (
                            <LoaderIcon className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                            <Play className="mr-1.5 h-4 w-4" />
                        )}
                        {isLoading ? translate("Blending...") : translate("Run Blend")}
                    </Button>
                    <Button variant="outline" disabled={isLoading} className="h-9">
                        <Save className="mr-1.5 h-4 w-4" />
                        {translate("Save Blend")}
                    </Button>
                </div>

                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <LoaderIcon className="h-6 w-6 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">{translate("Blending datasets...")}</p>
                        </div>
                    </div>
                )}

                {!isLoading && results.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                            <span className="text-sm font-semibold">
                                {results.length.toLocaleString()} {translate("rows blended")}
                            </span>
                        </div>
                        <div className="max-h-[480px] overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                                    <tr>
                                        {resultColumns.map((col) => (
                                            <th key={col} className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.slice(0, 50).map((row, i) => (
                                        <tr key={i} className="border-t border-border/50 transition-colors hover:bg-muted/40">
                                            {resultColumns.map((col) => (
                                                <td key={col} className="whitespace-nowrap px-4 py-2">
                                                    {String(row[col] ?? "")}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {results.length > 50 && (
                            <div className="border-t border-border/60 px-4 py-2 text-center text-xs text-muted-foreground">
                                {translate("Showing first 50 of")} {results.length.toLocaleString()} {translate("rows")}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

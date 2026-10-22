"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Database, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Dataset {
    id: number;
    name: string;
    row_count: number;
}

interface DatasetSelectorProps {
    value: number | null;
    onChange: (datasetId: number) => void;
}

export function DatasetSelector({ value, onChange }: DatasetSelectorProps) {
    useLanguage();
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        invoke<Dataset[]>("list_datasets").then(setDatasets);
    }, []);

    const selected = datasets.find((d) => d.id === value);

    return (
        <div className="relative shrink-0">
            <Button
                variant="outline"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="h-9 w-[15rem] max-w-[45vw] justify-between gap-2 px-3"
            >
                <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <Database className="h-3.5 w-3.5 shrink-0 text-primary" />
                    {selected ? (
                        <span className="truncate font-medium">{selected.name}</span>
                    ) : (
                        <span className="truncate text-muted-foreground">{translate("Select dataset")}</span>
                    )}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
            </Button>

            {open && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-1.5 max-h-80 w-72 overflow-auto rounded-xl border border-border/60 bg-card p-1.5 shadow-lg">
                        {datasets.map((dataset) => {
                            const isSelected = dataset.id === value;
                            return (
                                <button
                                    key={dataset.id}
                                    onClick={() => {
                                        onChange(dataset.id);
                                        setOpen(false);
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60 ${
                                        isSelected ? "bg-accent" : ""
                                    }`}
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                        <Database className="h-3.5 w-3.5" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{dataset.name}</p>
                                        <p className="font-data text-[11px] text-muted-foreground">
                                            {dataset.row_count.toLocaleString(getLocale())} {translate("rows")}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

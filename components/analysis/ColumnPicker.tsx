"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

interface Column {
    id: number;
    name: string;
    col_type: "INTEGER" | "REAL" | "TEXT";
}

interface ColumnPickerProps {
    datasetId: number | null;
    selected: string[];
    onChange: (columns: string[]) => void;
    placeholder?: string;
}

export function ColumnPicker({ datasetId, selected, onChange, placeholder = "Select columns" }: ColumnPickerProps) {
    useLanguage();
    const [columns, setColumns] = useState<Column[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (datasetId) {
            invoke<Column[]>("get_columns", { datasetId }).then(setColumns);
        }
    }, [datasetId]);

    const toggleColumn = (name: string) => {
        if (selected.includes(name)) {
            onChange(selected.filter((c) => c !== name));
        } else {
            onChange([...selected, name]);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex h-9 min-w-[150px] items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 text-left text-sm transition-colors hover:bg-muted/40"
            >
                {selected.length > 0 ? translate("{0} selected", { 0: selected.length }) : placeholder}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full z-20 mt-1.5 max-h-72 w-56 overflow-auto rounded-xl border border-border/60 bg-card p-1.5 shadow-lg">
                        {columns.map((col) => (
                            <button
                                key={col.id}
                                onClick={() => toggleColumn(col.name)}
                                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60"
                            >
                                <span className="text-sm">{col.name}</span>
                                {selected.includes(col.name) && (
                                    <Check className="w-4 h-4 text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

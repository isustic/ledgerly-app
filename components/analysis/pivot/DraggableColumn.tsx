"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, X } from "lucide-react";

interface DraggableColumnProps {
    id: string;
    label: string;
    onRemove?: () => void;
    compact?: boolean;
}

export function DraggableColumn({ id, label, onRemove, compact = false }: DraggableColumnProps) {
    useLanguage();
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });

    if (compact) {
        return (
            <div
                ref={setNodeRef}
                className={`flex max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-card px-2 py-1 text-xs shadow-sm transition-all hover:border-primary/40 ${
                    isDragging ? "opacity-50" : ""
                }`}
                title={translate(label)}
            >
                <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing min-w-0 flex-1 truncate font-medium">
                    {translate(label)}
                </span>
                {onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        aria-label={translate("Remove")}
                        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            className={`px-3 py-2 bg-muted/50 rounded text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2 ${
                isDragging ? "opacity-50" : ""
            }`}
            title={translate(label)}
        >
            <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing flex-1 min-w-0 truncate">
                {translate(label)}
            </span>
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                >
                    ×
                </button>
            )}
        </div>
    );
}

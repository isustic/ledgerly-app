"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface PivotDropZoneProps {
    id: string;
    label: string;
    children: React.ReactNode;
    className?: string;
    compact?: boolean;
}

export function PivotDropZone({ id, label, children, className, compact = false }: PivotDropZoneProps) {
    useLanguage();
    const { setNodeRef, isOver } = useDroppable({ id });

    if (compact) {
        const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
        return (
            <div className={cn("space-y-1.5", className)}>
                <div className="flex items-center justify-between px-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{translate(label)}</p>
                    {hasItems && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {Array.isArray(children) ? children.length : 1}
                        </span>
                    )}
                </div>
                <div
                    ref={setNodeRef}
                    className={cn(
                        "flex min-h-[64px] flex-wrap content-start gap-1.5 rounded-lg border-2 border-dashed p-2 transition-colors",
                        isOver ? "border-primary bg-primary/5" : "border-border/70 bg-muted/30",
                    )}
                >
                    {hasItems ? (
                        children
                    ) : (
                        <p className="m-auto text-xs text-muted-foreground/70">{translate("Drag fields here")}</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("space-y-2", className)}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{translate(label)}</p>
            <div
                ref={setNodeRef}
                className={cn(
                    "min-h-[60px] bg-card/50 border border-border/40 rounded-lg p-2 transition-colors",
                    isOver && "border-primary bg-primary/5"
                )}
            >
                {children || (
                    <p className="text-xs text-muted-foreground/60 text-center py-4">{translate("Drag columns here")}</p>
                )}
            </div>
        </div>
    );
}

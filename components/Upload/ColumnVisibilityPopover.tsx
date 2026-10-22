"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect } from "react";
import { Columns, Check, X, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface Column {
    id: number;
    name: string;
    col_type: string;
    display_name?: string;
}

interface ColumnVisibilityPopoverProps {
    columns: Column[];
    hiddenCols: Set<string>;
    onToggle: (columnName: string) => void;
    onShowAll: () => void;
    onHideAll: () => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
    INTEGER: <Hash className="w-3 h-3" />,
    REAL: <span className="text-[10px] font-mono">1.2</span>,
    TEXT: <span className="text-[10px] font-serif font-bold">Abc</span>,
};

export function ColumnVisibilityPopover({
    columns,
    hiddenCols,
    onToggle,
    onShowAll,
    onHideAll,
}: ColumnVisibilityPopoverProps) {
    useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const visibleCount = columns.length - hiddenCols.size;

    // Filter columns based on search query - search both name and display_name
    const filteredColumns = columns.filter((col) => {
        const displayName = col.display_name || col.name;
        return displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
               col.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Close popover when clicking backdrop
    const handleBackdropClick = () => {
        setIsOpen(false);
        setSearchQuery("");
    };

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
                setSearchQuery("");
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen]);

    return (
        <div className="relative">
            {/* Trigger Button */}
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                className="h-9 gap-1.5 bg-card"
            >
                <Columns className="w-3.5 h-3.5" />
                <span className="text-xs">
                    {translate("Columns (")}{visibleCount}/{columns.length})
                </span>
            </Button>

            {/* Backdrop */}
            {isOpen && (
                <div
                    onClick={handleBackdropClick}
                    className="fixed inset-0 z-40"
                    aria-hidden="true"
                />
            )}

            {/* Popover */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-card border border-border rounded-xl shadow-lg z-50 animate-fade-in">
                    {/* Header with search */}
                    <div className="p-3 border-b border-border">
                        <Input
                            placeholder={translate("Filter columns…")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 text-xs bg-background"
                            autoFocus
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                        <span className="text-xs font-medium text-muted-foreground">
                            {translate("Visibility")}</span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={onShowAll}
                                className="px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                            >
                                {translate("Show all")}</button>
                            <button
                                onClick={onHideAll}
                                className="px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                            >
                                {translate("Hide all")}</button>
                        </div>
                    </div>

                    {/* Column list */}
                    <div className="max-h-64 overflow-y-auto">
                        {filteredColumns.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className="text-xs text-muted-foreground">{translate("No columns found")}</p>
                            </div>
                        ) : (
                            <ul className="py-1">
                                {filteredColumns.map((col) => {
                                    const isHidden = hiddenCols.has(col.name);
                                    return (
                                        <li key={col.id}>
                                            <button
                                                onClick={() => onToggle(col.name)}
                                                className={cn(
                                                    "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                                                    isHidden
                                                        ? "text-muted-foreground hover:bg-muted/30"
                                                        : "text-foreground hover:bg-muted/20"
                                                )}
                                            >
                                                {/* Visibility icon */}
                                                <div className={cn(
                                                    "w-5 h-5 rounded flex items-center justify-center border transition-colors",
                                                    isHidden
                                                        ? "border-border/40 bg-background/40"
                                                        : "border-primary/30 bg-primary/10"
                                                )}>
                                                    {isHidden ? (
                                                        <X className="w-3 h-3 opacity-50" />
                                                    ) : (
                                                        <Check className="w-3.5 h-3.5 text-primary" />
                                                    )}
                                                </div>

                                                {/* Column name */}
                                                <span className={cn(
                                                    "flex-1 truncate text-xs font-medium",
                                                    isHidden && "opacity-60"
                                                )}>
                                                    {col.display_name || col.name}
                                                </span>

                                                {/* Type indicator */}
                                                <div className={cn(
                                                    "w-6 h-5 rounded flex items-center justify-center",
                                                    isHidden
                                                        ? "bg-muted/30 text-muted-foreground/50"
                                                        : "bg-muted/60 text-muted-foreground"
                                                )}>
                                                    {TYPE_ICONS[col.col_type] || TYPE_ICONS.TEXT}
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-3 py-2 border-t border-border bg-muted/20">
                        <p className="text-xs text-muted-foreground font-data">
                            {visibleCount} {" "}{translate("visible,")}{" "}{hiddenCols.size} {" "}{translate("hidden")}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

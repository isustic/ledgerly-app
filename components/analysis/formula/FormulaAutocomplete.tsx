"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect, useRef, useMemo } from "react";
import { AUTOCOMPLETE_FUNCTIONS } from "./constants";

export interface AutocompleteItem {
    type: "function" | "column";
    name: string;
    detail?: string;
    icon?: string;
}

interface FormulaAutocompleteProps {
    query: string;
    columns: string[];
    onSelect: (item: AutocompleteItem) => void;
    onClose: () => void;
    position: { top: number; left: number };
}

export function FormulaAutocomplete({
    query,
    columns,
    onSelect,
    onClose,
    position
}: FormulaAutocompleteProps) {
    useLanguage();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);

    // Memoize suggestions to prevent re-renders
    const suggestions: AutocompleteItem[] = useMemo(() => [
        ...AUTOCOMPLETE_FUNCTIONS.filter(f =>
            f.name.toLowerCase().startsWith(query.toLowerCase())
        ).map(f => ({ ...f, type: "function" as const })),
        ...columns.filter(c =>
            c.toLowerCase().includes(query.toLowerCase())
        ).map(c => ({ name: c, type: "column" as const, icon: "📄" }))
    ], [query, columns]);

    // Reset selected index when suggestions change
    useEffect(() => {
        setSelectedIndex(0);
    }, [suggestions]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && suggestions[selectedIndex]) {
                e.preventDefault();
                onSelect(suggestions[selectedIndex]);
            } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [suggestions, selectedIndex, onSelect, onClose]);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    if (suggestions.length === 0) return null;

    return (
        <div
            ref={menuRef}
            role="listbox"
            aria-label={translate("Formula suggestions")}
            className="fixed z-50 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto"
            style={{ top: position.top + 24, left: position.left }}
        >
            {suggestions.map((item, index) => (
                <button
                    key={`${item.type}-${item.name}`}
                    role="option"
                    aria-selected={index === selectedIndex}
                    onClick={() => onSelect(item)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                        index === selectedIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted"
                    }`}
                >
                    <span className="text-base">{item.icon}</span>
                    <span className="font-medium">{item.name}</span>
                    {item.detail && (
                        <span className="text-xs text-muted-foreground ml-auto">{translate(item.detail)}</span>
                    )}
                </button>
            ))}
        </div>
    );
}

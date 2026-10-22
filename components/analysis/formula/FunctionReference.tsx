"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useMemo } from "react";
import { Search, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FUNCTION_DATA, FUNCTION_CATEGORIES } from "./constants";

interface FunctionReferenceProps {
    onInsert: (fn: string) => void;
}

interface FunctionInfo {
    name: string;
    syntax: string;
    description: string;
    example: string;
    returnType: string;
}

interface FunctionCardProps {
    info: FunctionInfo;
    isExpanded: boolean;
    onToggle: () => void;
    onInsert: () => void;
}

function FunctionCard({ info, isExpanded, onToggle, onInsert }: FunctionCardProps) {
    useLanguage();
    return (
        <div className="border border-border/40 rounded-lg overflow-hidden bg-card/20">
            <button
                onClick={onToggle}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{info.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                        {translate(info.returnType)}
                    </span>
                </div>
            </button>

            {isExpanded && (
                <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/20">
                    <p className="text-xs text-muted-foreground mt-2">{translate(info.description)}</p>

                    <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{translate("Syntax")}</p>
                        <code className="block text-xs bg-muted/50 px-2 py-1 rounded font-mono">
                            {info.syntax}
                        </code>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{translate("Example")}</p>
                        <code className="block text-xs bg-muted/50 px-2 py-1 rounded font-mono">
                            {info.example}
                        </code>
                    </div>

                    <Button
                        onClick={(e) => {
                            e.stopPropagation();
                            onInsert();
                        }}
                        size="sm"
                        variant="outline"
                        className="w-full mt-2"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        {translate("Insert")}</Button>
                </div>
            )}
        </div>
    );
}

export function FunctionReference({ onInsert }: FunctionReferenceProps) {
    const language = useLanguage();
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedFunction, setExpandedFunction] = useState<string | null>(null);

    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) {
            return FUNCTION_CATEGORIES;
        }

        const query = searchQuery.toLowerCase();

        return FUNCTION_CATEGORIES
            .map((category) => ({
                ...category,
                functions: category.functions.filter((fnName) => {
                    const info = FUNCTION_DATA[fnName];
                    return (
                        info.name.toLowerCase().includes(query) ||
                        translate(info.description, {}, language).toLowerCase().includes(query)
                    );
                }),
            }))
            .filter((category) => category.functions.length > 0);
    }, [searchQuery, language]);

    const handleToggleFunction = (fnName: string) => {
        setExpandedFunction((prev) => (prev === fnName ? null : fnName));
    };

    const handleInsert = (fnName: string) => {
        onInsert(fnName);
        setExpandedFunction(null);
    };

    return (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{translate("Functions")}</h4>

            {/* Search Bar */}
            <div className="relative mb-3">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                    placeholder={translate("Search functions...")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 pl-7 text-xs"
                />
            </div>

            {/* Function List */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {filteredCategories.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">{translate("No functions found")}</p>
                ) : (
                    filteredCategories.map((category) => (
                        <div key={category.name}>
                            {/* Sticky Category Header */}
                            <div className="sticky top-0 z-10 bg-card py-1 -mx-1 px-1 border-b border-border/40 mb-2">
                                <p className="text-[10px] font-medium flex items-center gap-1 text-muted-foreground">
                                    <span>{category.icon}</span>
                                    <span>{translate(category.name)}</span>
                                </p>
                            </div>

                            {/* Function Cards */}
                            <div className="space-y-1.5">
                                {category.functions.map((fnName) => (
                                    <FunctionCard
                                        key={fnName}
                                        info={FUNCTION_DATA[fnName]}
                                        isExpanded={expandedFunction === fnName}
                                        onToggle={() => handleToggleFunction(fnName)}
                                        onInsert={() => handleInsert(fnName)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

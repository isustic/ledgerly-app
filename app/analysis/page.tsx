"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import Link from "next/link";
import { ArrowRight, Calculator, GitMerge, GitCompare, Table, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Workspace {
    href: string;
    label: string;
    icon: LucideIcon;
    description: string;
    highlights: string[];
    tone: string;
}

const workspaces: Workspace[] = [
    {
        href: "/analysis/pivot",
        label: "Pivot Tables",
        icon: Table,
        description: "Summarize rows into a grid. Drag fields to rows, columns and values.",
        highlights: ["Drag-and-drop fields", "Multi-level grouping", "Instant totals"],
        tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
        href: "/analysis/trends",
        label: "Trends",
        icon: TrendingUp,
        description: "Track how values move over time and compare periods side by side.",
        highlights: ["Time series", "Period comparison", "Sparkline previews"],
        tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
        href: "/analysis/formula",
        label: "Formula",
        icon: Calculator,
        description: "Write calculated fields with templates, autocomplete and a live preview.",
        highlights: ["Function reference", "Ready-made templates", "Live validation"],
        tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
        href: "/analysis/blend",
        label: "Blend",
        icon: GitMerge,
        description: "Join two datasets on shared keys to build one combined view.",
        highlights: ["Key matching", "Join types", "Combined preview"],
        tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
];

export default function AnalysisPage() {
    useLanguage();
    return (
        <div className="flex h-full flex-col overflow-auto bg-background">
            <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-10">
                <header className="mb-8 flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                        <GitCompare className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-primary">{translate("Advanced data workspaces")}</p>
                        <h1 className="text-3xl font-bold tracking-tight">{translate("Analysis")}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {translate("Pick a workspace to explore, calculate and combine your datasets.")}
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {workspaces.map((ws) => (
                        <Link
                            key={ws.href}
                            href={ws.href}
                            className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Card className="h-full border-border/60 bg-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
                                <CardContent className="flex h-full flex-col gap-5 p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${ws.tone}`}>
                                            <ws.icon className="h-6 w-6" />
                                        </div>
                                        <ArrowRight className="mt-1 h-4 w-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                                    </div>

                                    <div>
                                        <h2 className="text-lg font-semibold tracking-tight">{translate(ws.label)}</h2>
                                        <p className="mt-1.5 text-sm text-muted-foreground">{translate(ws.description)}</p>
                                    </div>

                                    <ul className="mt-auto flex flex-wrap gap-2">
                                        {ws.highlights.map((item) => (
                                            <li
                                                key={item}
                                                className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
                                            >
                                                {translate(item)}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

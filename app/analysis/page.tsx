"use client";

import Link from "next/link";
import { GitCompare, Table, TrendingUp, Calculator, GitMerge } from "lucide-react";

const workspaces = [
    { href: "/analysis/pivot", label: "Pivot Tables", icon: Table, description: "Multi-dimensional analysis with drag-and-drop" },
    { href: "/analysis/trends", label: "Trends", icon: TrendingUp, description: "Time series analysis and comparisons" },
    { href: "/analysis/formula", label: "Formula", icon: Calculator, description: "Create calculated fields" },
    { href: "/analysis/blend", label: "Blend", icon: GitMerge, description: "Join multiple datasets" },
];

export default function AnalysisPage() {
    return (
        <div className="flex flex-col h-full bg-background/50 mesh-bg">
            <div className="h-14 px-6 flex items-center gap-3 border-b border-border/50 bg-card">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                    <GitCompare className="w-4 h-4 text-primary" />
                </div>
                <div>
                    <h1 className="text-sm font-semibold">Analysis</h1>
                    <p className="text-[10px] text-muted-foreground">Advanced data workspaces</p>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-4xl">
                    <div className="grid grid-cols-2 gap-4">
                        {workspaces.map((ws) => (
                            <Link
                                key={ws.href}
                                href={ws.href}
                                className="bg-card/50 border border-border/40 rounded-xl p-5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <ws.icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-medium mb-1">{ws.label}</h3>
                                        <p className="text-xs text-muted-foreground">{ws.description}</p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

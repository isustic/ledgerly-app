"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { motion } from "framer-motion";
import { Upload, BarChart3, FileSpreadsheet, History, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UploadCard } from "@/components/dashboard/UploadCard";

const features = [
    {
        icon: Upload,
        title: "Import Excel",
        description: "Drop an .xlsx file and it's parsed into a searchable table in seconds.",
        tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
        icon: BarChart3,
        title: "Custom reports",
        description: "Group, calculate, filter and chart your data in a few guided steps.",
        tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
        icon: FileSpreadsheet,
        title: "EPro analysis",
        description: "Specialized EPro reports with agent tracking and program badges.",
        tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
        icon: History,
        title: "Dataset history",
        description: "Every import is kept by date, so past data is always one click away.",
        tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
];

const steps = ["Import", "Explore", "Report"];

export function WelcomeDashboard() {
    useLanguage();
    return (
        <div className="bg-background">
            <div className="container mx-auto max-w-6xl px-4 py-12 sm:py-16">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="mb-10 text-center"
                >
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
                        <FileSpreadsheet className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
                        {translate("Welcome to")}{" "}<span className="text-primary">Ledgerly</span>
                    </h1>
                    <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg">
                        {translate("Turn your Excel exports into clear, shareable reports, all on your own machine.")}</p>

                    {/* Step strip */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        {steps.map((step, i) => (
                            <span key={translate(step)} className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1">
                                    <span className="font-data text-xs text-primary">{i + 1}</span>
                                    {translate(step)}
                                </span>
                                {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 opacity-50" />}
                            </span>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
                    className="mx-auto mb-14 max-w-2xl"
                >
                    <UploadCard title={translate("Drop your first Excel file here")} />
                </motion.div>

                <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.2 + index * 0.06, ease: "easeOut" }}
                        >
                            <Card className="h-full border-border/60 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                                <CardContent className="p-5">
                                    <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${feature.tone}`}>
                                        <feature.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mb-1.5 font-semibold">{translate(feature.title)}</h3>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{translate(feature.description)}</p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}

"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/Upload/DataTable";
import { X } from "lucide-react";

const ENGLISH_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

interface HistoricDataModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    datasetId: number;
    datasetName: string;
    fileOrigin: string;
    rowCount: number;
    createdAt: string;
}

function formatEnglishDate(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = translate(ENGLISH_MONTHS[date.getMonth()]);
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${day}-${month}-${year} ${hours}:${minutes}`;
}

export function HistoricDataModal({
    open,
    onOpenChange,
    datasetId,
    datasetName,
    fileOrigin,
    rowCount,
    createdAt,
}: HistoricDataModalProps) {
    useLanguage();
    const formattedDate = formatEnglishDate(createdAt);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="!w-[96vw] !max-w-none h-[90vh] p-0 gap-0 flex flex-col">
                {/* Visually hidden title for accessibility */}
                <DialogTitle className="sr-only">{datasetName} {" "}{translate("- Historic Data")}</DialogTitle>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/30">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-semibold text-foreground">{datasetName}</h2>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{fileOrigin}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span>{formattedDate}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span>{rowCount.toLocaleString(getLocale())} {" "}{translate("rows")}</span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        className="h-8 w-8"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Body - DataTable */}
                <div className="flex-1 min-h-0">
                    <DataTable
                        datasetId={datasetId}
                        datasetName={datasetName}
                        rowCount={rowCount}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

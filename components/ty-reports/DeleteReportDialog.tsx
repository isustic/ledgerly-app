"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState } from "react";
import { safeInvoke } from "@/lib/tauri";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";

interface DeleteReportDialogProps {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  reportId: number;
  reportName: string;
}

export function DeleteReportDialog({ open, onClose, onDeleted, reportId, reportName }: DeleteReportDialogProps) {
  useLanguage();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isDeleting) return;
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await safeInvoke("delete_ty_report", { reportId });
      setIsDeleting(false);
      onDeleted();
    } catch (err) {
      console.error("Delete report failed:", err);
      setError(translate("Couldn’t delete this report. Please try again."));
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle>{translate("Delete TY Report")}</DialogTitle>
              <DialogDescription className="mt-1">
                {translate("Delete “{0}”? All its rows will be removed. This cannot be undone.", { 0: reportName })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isDeleting}>
            {translate("Cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {translate("Delete Report")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

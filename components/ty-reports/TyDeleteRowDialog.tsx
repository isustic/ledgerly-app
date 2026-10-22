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

interface TyDeleteRowDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  reportId: number;
  rowId: number;
}

export function TyDeleteRowDialog({
  open,
  onClose,
  onConfirm,
  reportId,
  rowId,
}: TyDeleteRowDialogProps) {
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
      await safeInvoke("delete_ty_report_row", { reportId, rowId });
      setIsDeleting(false);
      onConfirm();
    } catch (err) {
      console.error("Failed to delete row:", err);
      setError(translate("Couldn’t delete this row. Please try again."));
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
              <DialogTitle>{translate("Delete row")}</DialogTitle>
              <DialogDescription className="mt-1">
                {translate("Delete row #{0}? This action cannot be undone.", { 0: rowId })}
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
            {translate("Delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { translate, translateMessage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { Subgroup } from "@/types/subgroup";

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  subgroup: Subgroup | null;
}

export function DeleteDialog({ open, onClose, onConfirm, subgroup }: DeleteDialogProps) {
  useLanguage();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (isDeleting) return;
    if (!next) setError(null);
    if (!next) onClose();
  };

  const handleDelete = async () => {
    if (!subgroup) return;
    setIsDeleting(true);
    setError(null);
    try {
      await invoke("delete_subgroup", { cod: subgroup.cod });
      setIsDeleting(false);
      onConfirm();
    } catch (err) {
      console.error("Failed to delete subgroup:", err);
      setError(String(err));
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-destructive" />
            {translate("Delete subgroup")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                {translate("Are you sure you want to delete")}{" "}
                <strong className="font-data text-foreground">{subgroup?.cod}</strong>
                {translate("? This action cannot be undone.")}
              </p>
              {subgroup && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                  <p className="font-medium text-foreground">{subgroup.denumire}</p>
                  <p>
                    {subgroup.grupa} · {subgroup.subgrupa}
                  </p>
                </div>
              )}
              {error && <p className="text-xs text-destructive">{translateMessage(error)}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isDeleting}>
            {translate("Cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
            {isDeleting ? translate("Deleting...") : translate("Delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

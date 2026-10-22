"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, X, TriangleAlert } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  cod: string;
}

export function DeleteDialog({ open, onClose, onConfirm, cod }: DeleteDialogProps) {
    useLanguage();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await invoke("delete_subgroup", { cod });
      onConfirm();
    } catch (err) {
      console.error("Failed to delete subgroup:", err);
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="w-5 h-5 text-destructive" />
            {translate("Delete subgroup")}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            {translate("Are you sure you want to delete")}{" "}<strong>&apos;{cod}&apos;</strong>{translate("? This action cannot be undone.")}</p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            <X className="w-4 h-4 mr-1" />
            {translate("Cancel")}</Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
            {translate("Delete")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

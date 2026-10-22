"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import { safeInvoke } from "@/lib/tauri";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, X, Save, Pencil } from "lucide-react";

interface TyColumn {
  id: number;
  name: string;
  display_name?: string;
  col_type: string;
  display_order: number;
}

interface TyRow {
  _row_id: number;
  [key: string]: unknown;
}

interface TyReportRowModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  reportId: number;
  row: TyRow | null;
  columns: TyColumn[];
}

export function TyReportRowModal({
  open,
  onClose,
  onSave,
  onDelete,
  reportId,
  row,
  columns,
}: TyReportRowModalProps) {
    useLanguage();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && row) {
      const values: Record<string, string> = {};
      for (const col of columns) {
        const v = row[col.name];
        values[col.name] = v == null
          ? ""
          : col.col_type === "REAL" && typeof v === "number"
            ? (v as number).toFixed(2)
            : String(v);
      }
      setDraft(values);
    }
  }, [open, row, columns]);

  const handleSave = async () => {
    if (!row) return;
    setIsSaving(true);
    try {
      await safeInvoke("update_ty_report_row", {
        reportId,
        rowId: row._row_id,
        values: draft,
      });
      onSave();
    } catch (err) {
      console.error("Save row failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            {translate("Edit row #")}{row?._row_id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {columns.map((col) => (
            <div key={col.name} className="space-y-1.5">
              <Label htmlFor={`ty-edit-${col.name}`} className="text-xs">
                {col.display_name || col.name}
              </Label>
              <Input
                id={`ty-edit-${col.name}`}
                value={draft[col.name] ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [col.name]: e.target.value,
                  }))
                }
                disabled={isSaving}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={isSaving}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {translate("Delete")}</Button>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            <X className="w-4 h-4 mr-1" />
            {translate("Cancel")}</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {translate("Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

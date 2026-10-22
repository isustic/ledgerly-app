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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isNumericType, type TyColumn, type TyRow } from "@/components/ty-reports/types";
import { Loader2, Pencil, RotateCcw, Save, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Draft = Record<string, string>;

interface TyReportRowModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  reportId: number;
  row: TyRow | null;
  columns: TyColumn[];
}

const toDraft = (row: TyRow, columns: TyColumn[]): Draft => {
  const values: Draft = {};
  for (const col of columns) {
    const v = row[col.name];
    values[col.name] = v == null
      ? ""
      : col.col_type === "REAL" && typeof v === "number"
        ? v.toFixed(2)
        : String(v);
  }
  return values;
};

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
  const [draft, setDraft] = useState<Draft>({});
  const [initial, setInitial] = useState<Draft>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reset the form whenever a different row opens, without an effect.
  const [formRow, setFormRow] = useState<TyRow | null>(null);
  const activeRow = open ? row : null;
  if (activeRow !== formRow) {
    setFormRow(activeRow);
    if (activeRow) {
      const values = toDraft(activeRow, columns);
      setDraft(values);
      setInitial(values);
    }
    setError(null);
  }

  const changedNames = columns
    .map((col) => col.name)
    .filter((name) => (draft[name] ?? "") !== (initial[name] ?? ""));
  const isDirty = changedNames.length > 0;

  const reset = () => {
    setDraft(initial);
    setError(null);
  };

  const handleSave = async () => {
    if (!row || !isDirty || isSaving) return;
    // Send only the fields the user changed, so untouched values are never re-parsed or rounded.
    const changes = Object.fromEntries(changedNames.map((name) => [name, draft[name] ?? ""]));
    setIsSaving(true);
    setError(null);
    try {
      await safeInvoke("update_ty_report_row", {
        reportId,
        rowId: row._row_id,
        values: changes,
      });
      onSave();
    } catch (err) {
      console.error("Save row failed:", err);
      setError(translate("Couldn’t save this row. Check the values and try again."));
    } finally {
      setIsSaving(false);
    }
  };

  // Ctrl/⌘+Enter saves. Plain Enter is left alone so it can't save by accident from a button.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Pencil className="h-3.5 w-3.5" />
              </span>
              {translate("Edit row #")}{row?._row_id}
            </DialogTitle>
            {isDirty && (
              <span className="font-data text-xs tabular-nums text-primary" aria-live="polite">
                {translate("{0} unsaved", { 0: changedNames.length })}
              </span>
            )}
          </div>
          <DialogDescription>
            {translate("Change any value, then save. Press Ctrl/⌘ + Enter to save quickly.")}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid max-h-[60vh] grid-cols-1 gap-x-4 gap-y-3 overflow-y-auto py-1 sm:grid-cols-2">
          {columns.map((col) => {
            const id = `ty-edit-${col.name}`;
            const changed = changedNames.includes(col.name);
            const numeric = isNumericType(col.col_type);
            return (
              <div key={col.name} className="min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={id} className="truncate text-xs text-muted-foreground">
                    {col.display_name || col.name}
                  </Label>
                  {changed && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label={translate("Changed")} role="img" />
                  )}
                </div>
                <Input
                  id={id}
                  value={draft[col.name] ?? ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [col.name]: e.target.value }))}
                  disabled={isSaving}
                  inputMode={numeric ? "decimal" : undefined}
                  className={cn(
                    "h-9 text-sm",
                    numeric && "text-right font-data tabular-nums",
                    changed && "border-primary/40 bg-accent/40"
                  )}
                />
              </div>
            );
          })}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            disabled={isSaving}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            {translate("Delete")}
          </Button>
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button type="button" variant="ghost" onClick={reset} disabled={isSaving}>
                <RotateCcw className="h-4 w-4" />
                {translate("Reset")}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              {translate("Cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {translate("Save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

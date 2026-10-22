"use client";

import { translate, translateMessage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
import { Subgroup } from "@/types/subgroup";
import { cn } from "@/lib/utils";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

interface SubgroupModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: (subgroup: Subgroup) => void;
  editSubgroup: Subgroup | null;
  /** Existing group names, offered as suggestions so new rows reuse them. */
  groups: string[];
}

interface FormErrors {
  cod?: string;
  denumire?: string;
  grupa?: string;
  subgrupa?: string;
  general?: string;
}

const GROUP_LIST_ID = "subgroup-group-options";

export function SubgroupModal(props: SubgroupModalProps) {
  return (
    <Dialog open={props.open} onOpenChange={(next) => !next && props.onClose()}>
      <SubgroupForm {...props} />
    </Dialog>
  );
}

/** Mounts with the dialog content, so each open starts from the row being edited. */
function SubgroupForm({ onClose, onSave, onDelete, editSubgroup, groups }: SubgroupModalProps) {
  useLanguage();
  const [cod, setCod] = useState(editSubgroup?.cod ?? "");
  const [denumire, setDenumire] = useState(editSubgroup?.denumire ?? "");
  const [grupa, setGrupa] = useState(editSubgroup?.grupa ?? "");
  const [subgrupa, setSubgrupa] = useState(editSubgroup?.subgrupa ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!cod.trim()) newErrors.cod = "Cod is required";
    if (!denumire.trim()) newErrors.denumire = "Denumire is required";
    if (!grupa.trim()) newErrors.grupa = "Grupa is required";
    if (!subgrupa.trim()) newErrors.subgrupa = "Subgrupa is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (isSaving || !validateForm()) return;

    setIsSaving(true);
    setErrors({});

    try {
      const input = {
        cod: cod.trim(),
        denumire: denumire.trim(),
        grupa: grupa.trim(),
        subgrupa: subgrupa.trim(),
      };

      if (editSubgroup) {
        await invoke("update_subgroup", { cod: editSubgroup.cod, input });
      } else {
        await invoke("create_subgroup", { input });
      }

      onSave();
    } catch (err) {
      const errorMsg = String(err);
      if (errorMsg.includes("already exists")) {
        setErrors({ cod: errorMsg });
      } else {
        setErrors({ general: errorMsg });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (editSubgroup) onDelete(editSubgroup);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      e.preventDefault();
      handleSave();
    }
  };

  const fieldError = (name: keyof FormErrors) =>
    errors[name] ? (
      <p id={`${name}-error`} className="text-xs text-destructive">
        {translateMessage(errors[name]!)}
      </p>
    ) : null;

  return (
    <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editSubgroup ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
            {editSubgroup ? translate("Edit subgroup") : translate("Add subgroup")}
          </DialogTitle>
          <DialogDescription>
            {translate("Each code belongs to one group and one subgroup.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {errors.general && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {translateMessage(errors.general)}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cod">{translate("Cod *")}</Label>
              <Input
                id="cod"
                value={cod}
                onChange={(e) => setCod(e.target.value)}
                placeholder={translate("Enter cod")}
                disabled={isSaving}
                autoFocus={!editSubgroup}
                aria-invalid={!!errors.cod}
                aria-describedby={errors.cod ? "cod-error" : undefined}
                className={cn(errors.cod && "border-destructive")}
              />
              {fieldError("cod")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="denumire">{translate("Denumire *")}</Label>
              <Input
                id="denumire"
                value={denumire}
                onChange={(e) => setDenumire(e.target.value)}
                placeholder={translate("Enter denumire")}
                disabled={isSaving}
                autoFocus={!!editSubgroup}
                aria-invalid={!!errors.denumire}
                aria-describedby={errors.denumire ? "denumire-error" : undefined}
                className={cn(errors.denumire && "border-destructive")}
              />
              {fieldError("denumire")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grupa">{translate("Grupa *")}</Label>
              <Input
                id="grupa"
                list={GROUP_LIST_ID}
                value={grupa}
                onChange={(e) => setGrupa(e.target.value)}
                placeholder={translate("Enter grupa")}
                disabled={isSaving}
                aria-invalid={!!errors.grupa}
                aria-describedby={errors.grupa ? "grupa-error" : undefined}
                className={cn(errors.grupa && "border-destructive")}
              />
              <datalist id={GROUP_LIST_ID}>
                {groups.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
              {fieldError("grupa")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subgrupa">{translate("Subgrupa *")}</Label>
              <Input
                id="subgrupa"
                value={subgrupa}
                onChange={(e) => setSubgrupa(e.target.value)}
                placeholder={translate("Enter subgrupa")}
                disabled={isSaving}
                aria-invalid={!!errors.subgrupa}
                aria-describedby={errors.subgrupa ? "subgrupa-error" : undefined}
                className={cn(errors.subgrupa && "border-destructive")}
              />
              {fieldError("subgrupa")}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {editSubgroup ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {translate("Delete")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              {translate("Cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isSaving ? translate("Saving...") : translate("Save")}
            </Button>
          </div>
        </DialogFooter>
    </DialogContent>
  );
}

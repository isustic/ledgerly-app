"use client";

import { translate, translateMessage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
import { Subgroup } from "@/types/subgroup";
import { Loader2, Trash2, X, Save, Pencil, Plus } from "lucide-react";

interface SubgroupModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  editSubgroup: Subgroup | null;
}

interface FormErrors {
  cod?: string;
  denumire?: string;
  grupa?: string;
  subgrupa?: string;
  general?: string;
}

export function SubgroupModal({
  open,
  onClose,
  onSave,
  onDelete,
  editSubgroup,
}: SubgroupModalProps) {
    useLanguage();
  const [cod, setCod] = useState("");
  const [denumire, setDenumire] = useState("");
  const [grupa, setGrupa] = useState("");
  const [subgrupa, setSubgrupa] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens/closes or editSubgroup changes
  useEffect(() => {
    if (open) {
      if (editSubgroup) {
        setCod(editSubgroup.cod);
        setDenumire(editSubgroup.denumire);
        setGrupa(editSubgroup.grupa);
        setSubgrupa(editSubgroup.subgrupa);
      } else {
        setCod("");
        setDenumire("");
        setGrupa("");
        setSubgrupa("");
      }
      setErrors({});
    }
  }, [open, editSubgroup]);

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
    if (!validateForm()) return;

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
        await invoke("update_subgroup", {
          cod: editSubgroup.cod,
          input,
        });
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
    onClose();
    onDelete();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editSubgroup
              ? <><Pencil className="w-4 h-4" /> {" "}{translate("Edit subgroup")}</>
              : <><Plus className="w-4 h-4" /> {" "}{translate("Add subgroup")}</>
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {errors.general && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {translateMessage(errors.general)}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cod">{translate("Cod *")}</Label>
            <Input
              id="cod"
              value={cod}
              onChange={(e) => setCod(e.target.value)}
              placeholder={translate("Enter cod")}
              disabled={isSaving}
              className={errors.cod ? "border-destructive" : ""}
            />
            {errors.cod && <p className="text-xs text-destructive">{translateMessage(errors.cod)}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="denumire">{translate("Denumire *")}</Label>
            <Input
              id="denumire"
              value={denumire}
              onChange={(e) => setDenumire(e.target.value)}
              placeholder={translate("Enter denumire")}
              disabled={isSaving}
              className={errors.denumire ? "border-destructive" : ""}
            />
            {errors.denumire && <p className="text-xs text-destructive">{translateMessage(errors.denumire)}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="grupa">{translate("Grupa *")}</Label>
            <Input
              id="grupa"
              value={grupa}
              onChange={(e) => setGrupa(e.target.value)}
              placeholder={translate("Enter grupa")}
              disabled={isSaving}
              className={errors.grupa ? "border-destructive" : ""}
            />
            {errors.grupa && <p className="text-xs text-destructive">{translateMessage(errors.grupa)}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subgrupa">{translate("Subgrupa *")}</Label>
            <Input
              id="subgrupa"
              value={subgrupa}
              onChange={(e) => setSubgrupa(e.target.value)}
              placeholder={translate("Enter subgrupa")}
              disabled={isSaving}
              className={errors.subgrupa ? "border-destructive" : ""}
            />
            {errors.subgrupa && <p className="text-xs text-destructive">{translateMessage(errors.subgrupa)}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {editSubgroup && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {translate("Delete")}</Button>
          )}
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

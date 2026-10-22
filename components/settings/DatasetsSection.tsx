"use client";

import { translate, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Database, FileSpreadsheet, Pencil, Trash2, X } from "lucide-react";
import { SettingsCard } from "./SettingsCard";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Dataset } from "./types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(getLocale(), { month: "short", day: "numeric", year: "numeric" });
}

interface DatasetsSectionProps {
  datasets: Dataset[];
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function DatasetsSection({ datasets, onRename, onDelete }: DatasetsSectionProps) {
  useLanguage();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Dataset | null>(null);

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const startEdit = (dataset: Dataset) => {
    setEditingId(dataset.id);
    setEditValue(dataset.name);
  };

  const saveEdit = async (dataset: Dataset) => {
    const name = editValue.trim();
    if (!name || name === dataset.name) {
      cancelEdit();
      return;
    }
    setSavingId(dataset.id);
    try {
      await onRename(dataset.id, name);
      cancelEdit();
    } catch {
      // The page shows the error banner; keep the field open so the name can be fixed.
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <SettingsCard
        title={translate("Datasets")}
        action={<span className="text-xs text-muted-foreground">{translate("{count} imported", { count: datasets.length })}</span>}
      >
        {datasets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">{translate("No datasets yet")}</p>
            <p className="max-w-xs text-xs text-muted-foreground">{translate("Import Excel files from the Data Explorer")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {datasets.map((dataset) => {
              const editing = editingId === dataset.id;
              return (
                <li key={dataset.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Database className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveEdit(dataset);
                        }}
                      >
                        <Input
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") cancelEdit();
                          }}
                          aria-label={translate("Rename")}
                          className="h-8 max-w-sm text-sm"
                          autoFocus
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={translate("Save")}
                          disabled={savingId === dataset.id}
                          className="text-primary hover:bg-primary/10"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={translate("Cancel")}
                          onClick={cancelEdit}
                          className="text-muted-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </form>
                    ) : (
                      <>
                        <p className="truncate text-sm font-medium" title={dataset.name}>
                          {dataset.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-data tabular-nums">{dataset.row_count.toLocaleString(getLocale())}</span>{" "}
                          {translate("rows")} · {dataset.file_origin} · {formatDate(dataset.created_at)}
                        </p>
                      </>
                    )}
                  </div>

                  {!editing && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={translate("Rename")}
                        title={translate("Rename")}
                        onClick={() => startEdit(dataset)}
                        className="text-muted-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={translate("Delete")}
                        title={translate("Delete")}
                        onClick={() => setPendingDelete(dataset)}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={translate("Delete Dataset")}
        description={
          pendingDelete
            ? translate("Are you sure you want to delete \"{0}\"? This action cannot be undone.", { 0: pendingDelete.name })
            : ""
        }
        detail={
          pendingDelete && (
            <>
              <p className="font-medium text-foreground">{pendingDelete.name}</p>
              <p className="font-data tabular-nums">
                {pendingDelete.row_count.toLocaleString(getLocale())} {translate("rows")} · {pendingDelete.file_origin}
              </p>
            </>
          )
        }
        confirmLabel={translate("Delete")}
        pendingLabel={translate("Deleting...")}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

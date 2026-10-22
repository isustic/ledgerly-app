"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookMarked, Check, Database, Download, Loader2, Play, Save, Search, Sparkles, Trash2 } from "lucide-react";
import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Dataset, Template } from "@/types/report";

interface ReportHeaderProps {
  datasets: Dataset[];
  activeDatasetId: number | null;
  onDatasetChange: (id: number) => void;
  templates: Template[];
  activeTemplateName: string | null;
  onOpenTemplate: (template: Template) => void;
  onDeleteTemplate: (template: Template) => void;
  onSave: (name: string) => Promise<void>;
  canSave: boolean;
  canRun: boolean;
  isRunning: boolean;
  onRun: () => void;
  canExport: boolean;
  onExport: () => void;
  actionError: string | null;
}

export function ReportHeader({
  datasets,
  activeDatasetId,
  onDatasetChange,
  templates,
  activeTemplateName,
  onOpenTemplate,
  onDeleteTemplate,
  onSave,
  canSave,
  canRun,
  isRunning,
  onRun,
  canExport,
  onExport,
  actionError,
}: ReportHeaderProps) {
  useLanguage();

  return (
    <div className="border-b border-border/60 bg-card px-6 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="mr-auto flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">{translate("Build queries visually")}</p>
            <h1 className="text-xl font-bold tracking-tight">{translate("Report builder")}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={String(activeDatasetId ?? "")} onValueChange={(v) => onDatasetChange(Number(v))}>
              <SelectTrigger className="h-8 w-48 text-xs" aria-label={translate("Dataset")}>
                <SelectValue placeholder={translate("Select dataset")} />
              </SelectTrigger>
              <SelectContent>
                {datasets.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SavedReportsMenu
            templates={templates}
            activeName={activeTemplateName}
            onOpen={onOpenTemplate}
            onDelete={onDeleteTemplate}
          />

          <SaveReportButton canSave={canSave} onSave={onSave} />

          <Button variant="outline" size="sm" onClick={onExport} disabled={!canExport}>
            <Download className="h-3.5 w-3.5" />
            {translate("Export to Excel")}
          </Button>

          <Button size="sm" onClick={onRun} disabled={!canRun || isRunning} className="min-w-28 shadow-md shadow-primary/20">
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            {isRunning ? translate("Running…") : translate("Run report")}
          </Button>
        </div>
      </div>

      {actionError && (
        <Alert variant="destructive" className="mt-3 py-2">
          <AlertDescription className="text-xs">{actionError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function SavedReportsMenu({
  templates,
  activeName,
  onOpen,
  onDelete,
}: {
  templates: Template[];
  activeName: string | null;
  onOpen: (template: Template) => void;
  onDelete: (template: Template) => void;
}) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const needle = search.trim().toLowerCase();
  const visible = templates.filter((t) => t.name.toLowerCase().includes(needle));

  return (
    <div ref={rootRef} className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <BookMarked className="h-3.5 w-3.5" />
        {translate("Saved reports")}
        <Badge variant="secondary" className="font-data px-1.5">
          {templates.length}
        </Badge>
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-popover p-2 shadow-lg">
          {templates.length > 5 && (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={translate("Search reports…")}
                aria-label={translate("Search reports")}
                className="h-8 pl-8 text-xs"
                autoFocus
              />
            </div>
          )}

          {templates.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {translate("No saved reports yet. Run a report and save it to reuse it later.")}
            </p>
          ) : visible.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">{translate("No matching reports")}</p>
          ) : (
            <ul className="max-h-72 space-y-0.5 overflow-y-auto">
              {visible.map((template) => {
                const isActive = template.name === activeName;
                return (
                  <li
                    key={template.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-md pr-1 transition-colors duration-150",
                      isActive ? "bg-accent" : "hover:bg-muted",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onOpen(template);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm"
                    >
                      {isActive ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : <span className="h-3.5 w-3.5 shrink-0" />}
                      <span className={cn("truncate", isActive && "font-medium text-accent-foreground")}>{template.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(template)}
                      aria-label={translate("Delete {0}", { 0: template.name })}
                      className="rounded p-1.5 text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SaveReportButton({ canSave, onSave }: { canSave: boolean; onSave: (name: string) => Promise<void> }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    await onSave(trimmed);
    setSaving(false);
    setName("");
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!canSave}>
        <Save className="h-3.5 w-3.5" />
        {translate("Save")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{translate("Save report")}</DialogTitle>
              <DialogDescription>
                {translate("Give this report a name to open it again from Saved reports.")}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={translate("Enter report name…")}
                aria-label={translate("Report name")}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {translate("Cancel")}
              </Button>
              <Button type="submit" disabled={!name.trim() || saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {translate("Save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

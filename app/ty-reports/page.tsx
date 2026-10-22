"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect, useCallback, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { safeInvoke, safeOpen } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TyReportGrid } from "@/components/ty-reports/TyReportGrid";
import { ReportList } from "@/components/ty-reports/ReportList";
import { ReportSummary, formatReportDate } from "@/components/ty-reports/ReportSummary";
import { DeleteReportDialog } from "@/components/ty-reports/DeleteReportDialog";
import { type TyNotifyTone, type TyReport } from "@/components/ty-reports/types";
import {
  Download,
  FileSpreadsheet,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Pencil,
  Save,
  Table2,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Status {
  tone: TyNotifyTone;
  text: string;
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md animate-fade-in flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function TyReportsPageContent() {
  useLanguage();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<TyReport[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [listSearch, setListSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const selectedReport = reports.find((r) => r.id === selectedId) ?? null;

  const notify = useCallback((tone: TyNotifyTone, text: string) => setStatus({ tone, text }), []);

  // Success messages fade on their own; errors stay a little longer so they can be read.
  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), status.tone === "error" ? 8000 : 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const loadReports = useCallback(async () => {
    try {
      const result = await safeInvoke<TyReport[]>("list_ty_reports");
      setReports(result);
      return result;
    } catch (err) {
      console.error("Failed to load TY reports:", err);
      notify("error", translate("Couldn’t load reports."));
      return null;
    } finally {
      setListLoading(false);
    }
  }, [notify]);

  // Load the list once, then pick a report: the one in the URL, else the one already selected, else the first.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await loadReports();
      if (!mounted || !result) return;
      const paramId = searchParams.get("report");
      const fromUrl = paramId ? result.find((r) => r.id === Number(paramId)) : undefined;
      setSelectedId((current) => fromUrl?.id ?? current ?? result[0]?.id ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, [loadReports, searchParams]);

  const refreshReports = useCallback(async () => {
    await loadReports();
  }, [loadReports]);

  const selectReport = (id: number) => {
    setSelectedId(id);
    setEditingName(false);
  };

  const startRenaming = () => {
    if (!selectedReport) return;
    setDraftName(selectedReport.name);
    setEditingName(true);
  };

  const cancelRenaming = () => {
    setEditingName(false);
    setDraftName("");
  };

  const handleImport = async () => {
    try {
      const selected = await safeOpen({
        filters: [{ name: "Excel File", extensions: ["xlsx"] }],
        multiple: false,
      });
      if (typeof selected !== "string") return;

      // Split on both separators so Windows paths work too.
      const reportName = selected.split(/[\\/]/).pop()?.replace(/\.xlsx$/i, "") || translate("TY Report");
      setImporting(true);
      setStatus(null);
      const report = await safeInvoke<TyReport>("import_ty_report", {
        path: selected,
        reportName,
      });
      await loadReports();
      setSelectedId(report.id);
      notify("success", translate("Imported \"{0}\"", { 0: report.name }));
    } catch (err) {
      console.error("Import failed:", err);
      notify("error", translate("Import failed: {0}", { 0: String(err) }));
    } finally {
      setImporting(false);
    }
  };

  const handleRename = async () => {
    if (!selectedReport) return;
    const name = draftName.trim();
    if (!name || name === selectedReport.name) {
      cancelRenaming();
      return;
    }
    try {
      await safeInvoke("rename_ty_report", { reportId: selectedReport.id, name });
      await loadReports();
      setEditingName(false);
      notify("success", translate("Report renamed"));
    } catch (err) {
      console.error("Rename failed:", err);
      notify("error", translate("Rename failed: {0}", { 0: String(err) }));
    }
  };

  const handleReportDeleted = async () => {
    setDeleteOpen(false);
    // Land on the report that took the deleted one's place in the list.
    const index = reports.findIndex((r) => r.id === selectedId);
    const updated = (await loadReports()) ?? [];
    setSelectedId(updated[Math.min(Math.max(index, 0), updated.length - 1)]?.id ?? null);
    notify("success", translate("Report deleted"));
  };

  const handleExport = async () => {
    if (!selectedReport) return;
    setExporting(true);
    setStatus(null);
    try {
      const path = await safeInvoke<string>("export_ty_report", { reportId: selectedReport.id });
      notify("success", translate("Exported to {0}", { 0: path }));
    } catch (err) {
      // Closing the save dialog is not a failure.
      if (!/cancel/i.test(String(err))) {
        console.error("Export failed:", err);
        notify("error", translate("Export failed: {0}", { 0: String(err) }));
      }
    } finally {
      setExporting(false);
    }
  };

  const renderMain = () => {
    if (listLoading && reports.length === 0) {
      return (
        <div className="flex flex-1 flex-col gap-4 p-6" aria-busy="true" aria-label={translate("Loading")}>
          <div className="h-16 w-80 animate-pulse rounded-xl bg-muted/60" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-xl border border-border/60 bg-muted/50" />
            ))}
          </div>
          <div className="flex-1 animate-pulse rounded-xl border border-border bg-card" />
        </div>
      );
    }

    if (reports.length === 0) {
      return (
        <EmptyPanel
          icon={FolderOpen}
          title={translate("Import your first TY report")}
          description={translate("Upload Total Year Excel files to edit and export them")}
        >
          <Button onClick={handleImport} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {translate("Choose file…")}
          </Button>
        </EmptyPanel>
      );
    }

    if (!selectedReport) {
      return (
        <EmptyPanel
          icon={FileSpreadsheet}
          title={translate("Select a report")}
          description={translate("Choose a report from the list to view and edit its rows.")}
        />
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 xl:p-6">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-primary">
              {translate("TY Report")} · {translate("Imported {0}", { 0: formatReportDate(selectedReport.created_at) })}
            </p>
            {editingName ? (
              <div className="mt-1 flex items-center gap-2">
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") cancelRenaming();
                  }}
                  autoFocus
                  aria-label={translate("Report name")}
                  className="h-9 w-full max-w-sm text-base font-semibold"
                />
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleRename} aria-label={translate("Save")}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0"
                  onClick={cancelRenaming}
                  aria-label={translate("Cancel")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-xl font-semibold tracking-tight">{selectedReport.name}</h2>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={startRenaming}
                  aria-label={translate("Rename report")}
                  title={translate("Rename report")}
                  className="shrink-0 text-muted-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" className="h-9 gap-2" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {translate("Export Excel")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label={translate("More actions")}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={startRenaming}>
                  <Pencil className="h-4 w-4" />
                  {translate("Rename")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setDeleteOpen(true)}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {translate("Delete Report")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ReportSummary report={selectedReport} className="shrink-0" />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <TyReportGrid
            key={selectedReport.id}
            reportId={selectedReport.id}
            onRowCountChange={refreshReports}
            onNotify={notify}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Table2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">{translate("TY Reports")}</h1>
            <p className="truncate text-xs text-muted-foreground">{translate("Total Year Reports")}</p>
          </div>
        </div>
        <Button variant="outline" className="h-9 gap-2" onClick={handleImport} disabled={importing}>
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-primary" />}
          {translate("Import Excel")}
        </Button>
      </header>

      {status && (
        <div
          role="status"
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 border-b px-6 py-2 text-xs",
            status.tone === "error"
              ? "border-destructive/20 bg-destructive/10 text-destructive"
              : "border-border bg-muted/40 text-muted-foreground"
          )}
        >
          <span className="min-w-0 truncate">{status.text}</span>
          <button
            type="button"
            onClick={() => setStatus(null)}
            aria-label={translate("Dismiss")}
            className="shrink-0 rounded p-0.5 hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Report list */}
        <aside className="flex max-h-[40vh] shrink-0 flex-col border-b border-border/60 bg-card lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r xl:w-80">
          <ReportList
            reports={reports}
            selectedId={selectedId}
            onSelect={selectReport}
            searchQuery={listSearch}
            onSearchChange={setListSearch}
            loading={listLoading}
          />
        </aside>

        {/* Report */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{renderMain()}</main>
      </div>

      {selectedReport && (
        <DeleteReportDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onDeleted={handleReportDeleted}
          reportId={selectedReport.id}
          reportName={selectedReport.name}
        />
      )}
    </div>
  );
}

export default function TyReportsPage() {
  useLanguage();
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <TyReportsPageContent />
    </Suspense>
  );
}

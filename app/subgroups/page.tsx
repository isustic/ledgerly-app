"use client";

import { translate, translateMessage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Subgroup, SubgroupsResult } from "@/types/subgroup";
import { SubgroupTable, type SortDirection, type SortField } from "@/components/subgroups/SubgroupTable";
import { SubgroupModal } from "@/components/subgroups/SubgroupModal";
import { DeleteDialog } from "@/components/subgroups/DeleteDialog";
import { SubgroupSummary } from "@/components/subgroups/SubgroupSummary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Tags,
  Trash2,
  Upload,
  X,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

type Message = { tone: "success" | "error"; text: string };

const ALL_GROUPS = "all";

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

export default function SubgroupsPage() {
  useLanguage();
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  // Filters. Search and group run on the loaded rows, so the summary always reflects the full table.
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState(ALL_GROUPS);

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Excel actions
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Delete all
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Add / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editSubgroup, setEditSubgroup] = useState<Subgroup | null>(null);

  // Single delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subgroupToDelete, setSubgroupToDelete] = useState<Subgroup | null>(null);

  const fetchSubgroups = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const result = await invoke<SubgroupsResult>("get_subgroups", {
        page: 0,
        pageSize: 10000,
        search: null,
      });
      setSubgroups(result.rows);
    } catch (err) {
      console.error("Failed to fetch subgroups:", err);
      setFetchError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubgroups();
  }, [fetchSubgroups]);

  // Group names and counts, from the full table.
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const subgroup of subgroups) {
      counts.set(subgroup.grupa, (counts.get(subgroup.grupa) ?? 0) + 1);
    }
    return counts;
  }, [subgroups]);

  const groups = useMemo(
    () => Array.from(groupCounts.keys()).sort((a, b) => a.localeCompare(b)),
    [groupCounts]
  );

  const largestGroup = useMemo(() => {
    let best: { name: string; count: number } | null = null;
    groupCounts.forEach((count, name) => {
      if (!best || count > best.count) best = { name, count };
    });
    return best;
  }, [groupCounts]);

  const filteredSubgroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return subgroups.filter((subgroup) => {
      if (groupFilter !== ALL_GROUPS && subgroup.grupa !== groupFilter) return false;
      if (!query) return true;
      return [subgroup.cod, subgroup.denumire, subgroup.grupa, subgroup.subgrupa].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  }, [subgroups, searchQuery, groupFilter]);

  const sortedSubgroups = useMemo(() => {
    if (!sortField || !sortDirection) return filteredSubgroups;

    return [...filteredSubgroups].sort((a, b) => {
      const result = a[sortField].localeCompare(b[sortField]);
      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredSubgroups, sortField, sortDirection]);

  const hasFilters = searchQuery.trim() !== "" || groupFilter !== ALL_GROUPS;
  const showEmptyDatabase = !loading && !fetchError && subgroups.length === 0;

  const handleSortChange = useCallback(
    (field: SortField) => {
      if (sortField !== field) {
        setSortField(field);
        setSortDirection("asc");
        return;
      }
      // Cycle asc → desc → none
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection(null);
      }
    },
    [sortField, sortDirection]
  );

  const clearFilters = () => {
    setSearchQuery("");
    setGroupFilter(ALL_GROUPS);
  };

  const handleAdd = () => {
    setEditSubgroup(null);
    setModalOpen(true);
  };

  const handleRowClick = (subgroup: Subgroup) => {
    setEditSubgroup(subgroup);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditSubgroup(null);
  };

  const handleSave = () => {
    setModalOpen(false);
    setEditSubgroup(null);
    setMessage({ tone: "success", text: translate("Subgroup saved.") });
    fetchSubgroups();
  };

  const handleDeleteRequest = (subgroup: Subgroup) => {
    setModalOpen(false);
    setEditSubgroup(null);
    setSubgroupToDelete(subgroup);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    setDeleteDialogOpen(false);
    setSubgroupToDelete(null);
    setMessage({ tone: "success", text: translate("Subgroup deleted.") });
    fetchSubgroups();
  };

  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setSubgroupToDelete(null);
  };

  const handleImportExcel = async () => {
    setMessage(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      const filePath = Array.isArray(selected) ? selected[0] : selected;
      if (!filePath) return;

      setImporting(true);
      const count = await invoke<number>("import_subgroups_from_excel", { path: filePath });
      await fetchSubgroups();
      setMessage({ tone: "success", text: translate("Imported {0} subgroups.", { 0: count }) });
    } catch (err) {
      setMessage({ tone: "error", text: translateMessage(String(err)) });
    } finally {
      setImporting(false);
    }
  };

  const handleExportExcel = async () => {
    setMessage(null);
    try {
      const filePath = await save({
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
        defaultPath: `subgroups_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      if (!filePath) return;

      setExporting(true);
      await invoke<string>("export_subgroups_to_excel", { path: filePath });
      setMessage({ tone: "success", text: translate("Subgroups exported.") });
    } catch (err) {
      setMessage({ tone: "error", text: translateMessage(String(err)) });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const deleted = await invoke<number>("delete_all_subgroups");
      setDeleteAllDialogOpen(false);
      await fetchSubgroups();
      setMessage({ tone: "success", text: translate("Deleted {0} subgroups.", { 0: deleted }) });
    } catch (err) {
      setMessage({ tone: "error", text: translateMessage(String(err)) });
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Tags className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">{translate("Subgroups")}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {translate("Product codes and the groups they belong to")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 gap-2" disabled={importing || exporting}>
                {importing || exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                Excel
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={handleImportExcel} disabled={importing}>
                <Upload className="h-4 w-4" />
                {importing ? translate("Importing...") : translate("Import from Excel")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} disabled={exporting || subgroups.length === 0}>
                <Download className="h-4 w-4" />
                {exporting ? translate("Exporting...") : translate("Export to Excel")}
              </DropdownMenuItem>
              {subgroups.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={() => setDeleteAllDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {translate("Delete all")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button className="h-9 gap-2" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            {translate("Add subgroup")}
          </Button>
        </div>
      </header>

      {/* Status */}
      {message && (
        <div
          role="status"
          className={
            message.tone === "error"
              ? "flex shrink-0 items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-xs text-destructive"
              : "flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/40 px-6 py-2 text-xs text-muted-foreground"
          }
        >
          <span>{message.text}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={translate("Close")}
            onClick={() => setMessage(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 xl:p-6">
        {fetchError && (
          <Alert variant="destructive" className="shrink-0 py-2.5">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{translate("Couldn’t load subgroups.")}</span>
              <Button variant="outline" size="sm" className="bg-background" onClick={fetchSubgroups}>
                <RotateCcw className="h-3.5 w-3.5" />
                {translate("Try again")}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {showEmptyDatabase ? (
          <EmptyPanel
            icon={Tags}
            title={translate("No subgroups yet")}
            description={translate("Import your subgroups from an Excel file, or add them one by one.")}
          >
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={handleImportExcel} disabled={importing}>
                <Upload className="h-4 w-4" />
                {importing ? translate("Importing...") : translate("Import from Excel")}
              </Button>
              <Button size="sm" variant="outline" className="bg-background" onClick={handleAdd}>
                <Plus className="h-4 w-4" />
                {translate("Add manually")}
              </Button>
            </div>
          </EmptyPanel>
        ) : (
          <>
            <SubgroupSummary
              total={subgroups.length}
              groupCount={groups.length}
              largestGroup={largestGroup}
              shown={sortedSubgroups.length}
            />

            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <div className="relative min-w-[14rem] max-w-sm flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={translate("Search subgroups...")}
                    aria-label={translate("Search subgroups...")}
                    className="h-9 bg-card pl-9 pr-9"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                      aria-label={translate("Clear")}
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="w-[12rem]">
                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger className="h-9 w-full" aria-label={translate("Group")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_GROUPS}>{translate("All groups")}</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group} value={group}>
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {hasFilters && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
                    {translate("Clear filters")}
                  </Button>
                )}
              </div>

              <SubgroupTable
                rows={sortedSubgroups}
                totalCount={subgroups.length}
                query={searchQuery}
                loading={loading}
                hasFilters={hasFilters}
                sortField={sortField}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
                onRowClick={handleRowClick}
                onDeleteClick={handleDeleteRequest}
                onClearFilters={clearFilters}
              />
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <SubgroupModal
        open={modalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        onDelete={handleDeleteRequest}
        editSubgroup={editSubgroup}
        groups={groups}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onClose={handleDeleteDialogClose}
        onConfirm={handleDeleteConfirm}
        subgroup={subgroupToDelete}
      />

      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              {translate("Delete all subgroups?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {translate("This will permanently delete all {0} subgroups from the database. This action cannot be undone.", {
                0: subgroups.length,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteAllDialogOpen(false)} disabled={deletingAll}>
              {translate("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={deletingAll}>
              {deletingAll ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              {deletingAll ? translate("Deleting...") : translate("Delete all {0}", { 0: subgroups.length })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

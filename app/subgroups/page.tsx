"use client";

import { translate, translateMessage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Subgroup, SubgroupsResult } from "@/types/subgroup";
import { SubgroupTable } from "@/components/subgroups/SubgroupTable";
import { SubgroupModal } from "@/components/subgroups/SubgroupModal";
import { DeleteDialog } from "@/components/subgroups/DeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Plus, Search, FileSpreadsheet, Upload, Download, ChevronDown, Trash2, X } from "lucide-react";

type SortField = "cod" | "denumire" | "grupa" | "subgrupa" | null;
type SortDirection = "asc" | "desc" | null;

export default function SubgroupsPage() {
    useLanguage();
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Delete all state
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editSubgroup, setEditSubgroup] = useState<Subgroup | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subgroupToDelete, setSubgroupToDelete] = useState<Subgroup | null>(null);

  // Sort subgroups
  const sortedSubgroups = useMemo(() => {
    if (!sortField || !sortDirection) {
      return subgroups;
    }

    return [...subgroups].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (sortDirection === "asc") {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
  }, [subgroups, sortField, sortDirection]);

  // Handle sort change
  const handleSortChange = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : sortDirection === "desc" ? null : "asc");
      if (sortDirection === "desc") {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      // New field, default to asc
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField, sortDirection]);

  // Fetch subgroups
  const fetchSubgroups = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<SubgroupsResult>("get_subgroups", {
        page: 0,
        pageSize: 10000,
        search: debouncedSearch || null,
      });
      setSubgroups(result.rows);
    } catch (err) {
      console.error("Failed to fetch subgroups:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Fetch on mount and search change
  useEffect(() => {
    fetchSubgroups();
  }, [fetchSubgroups]);

  // Open modal for adding
  const handleAdd = () => {
    setEditSubgroup(null);
    setModalOpen(true);
  };

  // Open modal for editing
  const handleRowClick = (subgroup: Subgroup) => {
    setEditSubgroup(subgroup);
    setModalOpen(true);
  };

  // Handle save from modal
  const handleSave = () => {
    setModalOpen(false);
    fetchSubgroups();
  };

  // Handle delete button click from modal
  const handleDeleteClick = () => {
    if (editSubgroup) {
      setSubgroupToDelete(editSubgroup);
      setDeleteDialogOpen(true);
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    setDeleteDialogOpen(false);
    setSubgroupToDelete(null);
    fetchSubgroups();
  };

  // Handle modal close
  const handleModalClose = () => {
    setModalOpen(false);
    setEditSubgroup(null);
  };

  // Handle delete dialog close
  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setSubgroupToDelete(null);
  };

  // Handle import from Excel
  const handleImportExcel = async () => {
    setImportError(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Excel',
          extensions: ['xlsx', 'xls']
        }]
      });

      const filePath = Array.isArray(selected)
        ? selected[0]
        : selected;

      if (filePath) {
        setImporting(true);
        await invoke<number>('import_subgroups_from_excel', {
          path: filePath
        });
        await fetchSubgroups();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import subgroups';
      setImportError(message);
    } finally {
      setImporting(false);
    }
  };

  // Handle export to Excel
  const handleExportExcel = async () => {
    try {
      const filePath = await save({
        filters: [{
          name: 'Excel',
          extensions: ['xlsx']
        }],
        defaultPath: `subgroups_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });

      if (filePath) {
        setExporting(true);
        await invoke<string>('export_subgroups_to_excel', {
          path: filePath
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export subgroups';
      setImportError(message);
    } finally {
      setExporting(false);
    }
  };

  // Handle delete all
  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      await invoke<number>("delete_all_subgroups");
      setDeleteAllDialogOpen(false);
      await fetchSubgroups();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete subgroups";
      setImportError(message);
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/50 bg-card/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold">{translate("Manage subgroups")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleAdd} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              {translate("Add subgroup")}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  Excel
                  <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleImportExcel} disabled={importing}>
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? translate("Importing...") : translate("Import from Excel")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} disabled={exporting || subgroups.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  {exporting ? translate("Exporting...") : translate("Export to Excel")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex-1" />
            {subgroups.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteAllDialogOpen(true)}
                className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {translate("Delete all")}</Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={translate("Search subgroups...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Error Banner */}
      {importError && (
        <div className="mx-6 mt-4 flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
          <span className="text-sm">{translateMessage(importError)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1 text-destructive hover:text-destructive hover:bg-destructive/20"
            onClick={() => setImportError(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Table / Empty State */}
      <div className="flex-1 overflow-auto p-6">
        {subgroups.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8 rounded-lg border border-border/50 bg-card/50 max-w-sm">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">{translate("No subgroups yet")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {translate("Import your subgroups from an Excel file to get started.")}</p>
              <Button onClick={handleImportExcel} disabled={importing}>
                {importing ? translate("Importing...") : translate("Import from Excel")}
              </Button>
            </div>
          </div>
        ) : (
          <SubgroupTable
            subgroups={sortedSubgroups}
            searchQuery={searchQuery}
            onRowClick={handleRowClick}
            loading={loading}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
          />
        )}
      </div>

      {/* Modals */}
      <SubgroupModal
        open={modalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        onDelete={handleDeleteClick}
        editSubgroup={editSubgroup}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onClose={handleDeleteDialogClose}
        onConfirm={handleDeleteConfirm}
        cod={subgroupToDelete?.cod || ""}
      />

      {/* Delete all confirmation */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{translate("Delete all subgroups?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {translate("This will permanently delete all")}{" "}{subgroups.length} {" "}{translate("subgroups from the database. This action cannot be undone.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllDialogOpen(false)} disabled={deletingAll}>
              {translate("Cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={deletingAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              {deletingAll ? translate("Deleting...") : translate("Delete all {0}", { 0: subgroups.length })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

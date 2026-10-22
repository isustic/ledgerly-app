"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Subgroup } from "@/types/subgroup";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";

type SortField = "cod" | "denumire" | "grupa" | "subgrupa";
type SortDirection = "asc" | "desc" | null;

interface SubgroupTableProps {
  subgroups: Subgroup[];
  searchQuery: string;
  onRowClick: (subgroup: Subgroup) => void;
  loading?: boolean;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
}

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "cod", label: "Cod" },
  { key: "denumire", label: "Denumire" },
  { key: "grupa", label: "Grupa" },
  { key: "subgrupa", label: "Subgrupa" },
];

export function SubgroupTable({
  subgroups,
  searchQuery,
  onRowClick,
  loading,
  sortField,
  sortDirection,
  onSortChange,
}: SubgroupTableProps) {
    useLanguage();
  if (loading) {
    return (
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key}>{translate(col.label)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 bg-muted/50 animate-pulse rounded w-16" /></TableCell>
                <TableCell><div className="h-4 bg-muted/50 animate-pulse rounded w-32" /></TableCell>
                <TableCell><div className="h-4 bg-muted/50 animate-pulse rounded w-20" /></TableCell>
                <TableCell><div className="h-4 bg-muted/50 animate-pulse rounded w-20" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (subgroups.length === 0) {
    return (
      <div className="border border-border/50 rounded-lg p-12 text-center">
        <p className="text-muted-foreground">
          {searchQuery
            ? translate("No subgroups match '{0}'", { 0: searchQuery })
            : translate("No subgroups yet. Click 'Add' to create one.")}
        </p>
      </div>
    );
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown size={12} className="text-muted-foreground/30" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp size={12} className="text-primary" />
    ) : (
      <ChevronDown size={12} className="text-primary" />
    );
  };

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                className="cursor-pointer hover:bg-muted/30 select-none transition-colors group"
                onClick={() => onSortChange(col.key)}
              >
                <div className="flex items-center gap-2">
                  <span>{translate(col.label)}</span>
                  <span className="flex items-center">{getSortIcon(col.key)}</span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {subgroups.map((subgroup) => (
            <TableRow
              key={subgroup.cod}
              className={cn(
                "cursor-pointer transition-colors hover:bg-primary/5",
              )}
              onClick={() => onRowClick(subgroup)}
            >
              <TableCell className="font-medium">{subgroup.cod}</TableCell>
              <TableCell>{subgroup.denumire}</TableCell>
              <TableCell>{subgroup.grupa}</TableCell>
              <TableCell>{subgroup.subgrupa}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

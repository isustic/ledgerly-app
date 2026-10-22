"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  summary: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SectionCard({ icon: Icon, title, summary, count, defaultOpen = true, children }: SectionCardProps) {
  useLanguage();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/40"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        {count !== undefined && count > 0 && (
          <Badge className="font-data">{count}</Badge>
        )}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", !open && "-rotate-90")}
        />
      </button>
      {open && <div className="space-y-4 border-t border-border/60 px-4 py-4">{children}</div>}
    </section>
  );
}

export function SectionHint({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
      <Icon className="mt-px h-3.5 w-3.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-muted-foreground">{children}</span>;
}

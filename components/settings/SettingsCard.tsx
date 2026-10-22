"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  tone?: "default" | "danger";
  children: ReactNode;
}

export function SettingsCard({ title, description, action, tone = "default", children }: SettingsCardProps) {
  const danger = tone === "danger";

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/60 bg-card shadow-sm",
        danger && "border-destructive/30 bg-destructive/5"
      )}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h3 className={cn("text-sm font-semibold", danger && "text-destructive")}>{title}</h3>
            )}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

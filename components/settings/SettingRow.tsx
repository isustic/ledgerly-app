"use client";

import type { ReactNode } from "react";

interface SettingRowProps {
  label: string;
  hint?: string;
  control: ReactNode;
}

export function SettingRow({ label, hint, control }: SettingRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

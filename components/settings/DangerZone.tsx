"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { SettingsCard } from "./SettingsCard";
import { ConfirmDialog } from "./ConfirmDialog";

interface DangerZoneProps {
  disabled: boolean;
  onClearAll: () => Promise<void>;
}

export function DangerZone({ disabled, onClearAll }: DangerZoneProps) {
  useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingsCard tone="danger" title={translate("Danger Zone")}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5">
          <p className="max-w-xl text-xs text-muted-foreground">
            {translate("Permanently delete all data. This includes every dataset, report template, query history, and favorite. Subgroup data is preserved.")}
          </p>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
            <Trash2 className="h-3.5 w-3.5" />
            {translate("Clear All Data")}
          </Button>
        </div>
      </SettingsCard>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={translate("Clear All Data")}
        description={translate("Are you sure you want to clear ALL data? This will delete every dataset, report, template, and query history. This action cannot be undone.")}
        confirmLabel={translate("Clear All Data")}
        pendingLabel={translate("Clearing...")}
        onConfirm={async () => {
          await onClearAll();
          setOpen(false);
        }}
      />
    </>
  );
}

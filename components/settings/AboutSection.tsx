"use client";

import { translate, translateMessage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Download, Info, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeInvoke } from "@/lib/tauri";
import { UpdateDialog, type UpdateInfo } from "@/components/UpdateDialog";
import { SettingsCard } from "./SettingsCard";

type UpdateStatus = { type: "success" | "info" | "error"; message: string };

export function AboutSection() {
  useLanguage();
  const [appVersion, setAppVersion] = useState("");
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    import("@tauri-apps/api/app")
      .then((m) => m.getVersion())
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  const checkNow = async () => {
    setChecking(true);
    setStatus(null);
    try {
      const info = await safeInvoke<UpdateInfo | null>("check_for_updates");
      if (info) {
        setUpdate(info);
        setStatus({ type: "success", message: `Version ${info.version} is available.` });
      } else {
        setStatus({ type: "info", message: "You're on the latest version." });
      }
    } catch {
      setStatus({ type: "error", message: "Could not check for updates." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsCard
        title={translate("App Updates")}
        description={translate("Check for new versions")}
        action={
          <Button variant="outline" size="sm" onClick={checkNow} disabled={checking} className="bg-background">
            <Download className="h-3.5 w-3.5" />
            {checking ? translate("Checking...") : translate("Check for Updates")}
          </Button>
        }
      >
        {status && (
          <div
            role="status"
            className={cn(
              "m-4 flex items-center gap-2 rounded-md px-3 py-2 text-xs",
              status.type === "success" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              status.type === "info" && "bg-primary/10 text-primary",
              status.type === "error" && "bg-destructive/10 text-destructive"
            )}
          >
            {status.type === "success" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
            {status.type === "info" && <Info className="h-3.5 w-3.5 shrink-0" />}
            {status.type === "error" && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
            <span>{translateMessage(status.message)}</span>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title={translate("About")}>
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Ledgerly</p>
            <p className="font-data text-xs text-muted-foreground">
              {translate("Version")} {appVersion || "—"}
            </p>
          </div>
        </div>
      </SettingsCard>

      <UpdateDialog open={update !== null} update={update} onClose={() => setUpdate(null)} />
    </div>
  );
}

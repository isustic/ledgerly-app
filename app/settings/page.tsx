"use client";

import { translate, translateMessage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Settings2, X } from "lucide-react";
import { safeInvoke } from "@/lib/tauri";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { GeneralSection } from "@/components/settings/GeneralSection";
import { UsageOverview } from "@/components/settings/UsageOverview";
import { DatasetsSection } from "@/components/settings/DatasetsSection";
import { DangerZone } from "@/components/settings/DangerZone";
import { AboutSection } from "@/components/settings/AboutSection";
import type { ActivityDay, Dataset, SettingsSectionId, UsageStats } from "@/components/settings/types";

const SECTION_STORAGE_KEY = "settings-section";
const SECTION_IDS: SettingsSectionId[] = ["general", "data", "about"];

// Selection lives in memory too, so the nav still works when storage is blocked.
let currentSection: SettingsSectionId | null = null;
const sectionListeners = new Set<() => void>();

function readSection(): SettingsSectionId {
  if (currentSection) return currentSection;
  try {
    const stored = window.localStorage.getItem(SECTION_STORAGE_KEY) as SettingsSectionId | null;
    if (stored && SECTION_IDS.includes(stored)) return stored;
  } catch {
    /* Storage can be blocked; fall back to the first section. */
  }
  return "general";
}

function writeSection(next: SettingsSectionId) {
  currentSection = next;
  try {
    window.localStorage.setItem(SECTION_STORAGE_KEY, next);
  } catch {
    /* Session only. */
  }
  sectionListeners.forEach((listener) => listener());
}

function subscribeSection(listener: () => void) {
  sectionListeners.add(listener);
  return () => {
    sectionListeners.delete(listener);
  };
}

type Banner = { tone: "success" | "error"; text: string };

export default function SettingsPage() {
  useLanguage();
  // Server render uses the default section; the stored one applies after hydration.
  const section = useSyncExternalStore(subscribeSection, readSection, (): SettingsSectionId => "general");
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  const changeSection = (next: SettingsSectionId) => writeSection(next);

  // Only state set after the await, so the effect itself never sets state synchronously.
  const loadData = useCallback(async () => {
    try {
      const [statsData, activityData, datasetsData] = await Promise.all([
        safeInvoke<UsageStats>("get_usage_stats"),
        safeInvoke<ActivityDay[]>("get_activity_heatmap", { days: 90 }),
        safeInvoke<Dataset[]>("list_datasets"),
      ]);
      setStats(statsData);
      setActivity(activityData);
      setDatasets(datasetsData);
    } catch (err) {
      console.error("Failed to load settings data:", err);
      setLoadError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Every state update in loadData runs after an await, so this does not cascade renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(null);
    void loadData();
  };

  const renameDataset = async (datasetId: number, name: string) => {
    try {
      await safeInvoke("rename_dataset", { datasetId, newName: name });
      setDatasets((prev) => prev.map((d) => (d.id === datasetId ? { ...d, name } : d)));
      setBanner({ tone: "success", text: translate("Dataset renamed.") });
    } catch (err) {
      console.error("Failed to rename dataset:", err);
      setBanner({ tone: "error", text: translate("Failed to rename dataset. Please try again.") });
      throw err;
    }
  };

  // Errors are rethrown so the confirm dialog can show them and stay open.
  const deleteDataset = async (datasetId: number) => {
    try {
      await safeInvoke("delete_dataset", { datasetId });
    } catch (err) {
      console.error("Failed to delete dataset:", err);
      throw err;
    }
    setDatasets((prev) => prev.filter((d) => d.id !== datasetId));
    setBanner({ tone: "success", text: translate("Dataset deleted.") });
    loadData();
  };

  const clearAllData = async () => {
    try {
      await safeInvoke("clear_database");
    } catch (err) {
      console.error("Failed to clear database:", err);
      throw err;
    }
    setBanner({ tone: "success", text: translate("All data has been cleared.") });
    await loadData();
  };

  // Hide the list until we know what it holds, so an empty state never flashes during load or after an error.
  const showDatasets = !loadError && (!loading || datasets.length > 0);

  const sectionTitle: Record<SettingsSectionId, string> = {
    general: translate("General"),
    data: translate("Data"),
    about: translate("About"),
  };

  const sectionDescription: Record<SettingsSectionId, string> = {
    general: translate("Language and appearance of the app."),
    data: translate("Your usage, imported datasets and data removal."),
    about: translate("Updates and app information."),
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">{translate("Settings")}</h1>
            <p className="truncate text-xs text-muted-foreground">{translate("Manage your preferences")}</p>
          </div>
        </div>
      </header>

      {/* Status */}
      {banner && (
        <div
          role="status"
          className={
            banner.tone === "error"
              ? "flex shrink-0 items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-xs text-destructive"
              : "flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/40 px-6 py-2 text-xs text-muted-foreground"
          }
        >
          <span>{translateMessage(banner.text)}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={translate("Close")}
            onClick={() => setBanner(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 xl:p-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:gap-10">
          <SettingsNav active={section} onChange={changeSection} />

          <div key={section} className="min-w-0 flex-1 animate-fade-in space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{sectionTitle[section]}</h2>
              <p className="text-sm text-muted-foreground">{sectionDescription[section]}</p>
            </div>

            {section === "general" && <GeneralSection />}

            {section === "data" && (
              <div className="space-y-6">
                {loadError && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertDescription className="flex items-center justify-between gap-3">
                      <span>{translate("Couldn’t load your data.")}</span>
                      <Button variant="outline" size="sm" className="bg-background" onClick={retryLoad}>
                        {translate("Try again")}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <UsageOverview stats={stats} activity={activity} loading={loading} />

                {showDatasets && (
                  <DatasetsSection datasets={datasets} onRename={renameDataset} onDelete={deleteDataset} />
                )}

                <DangerZone disabled={loading || datasets.length === 0} onClearAll={clearAllData} />
              </div>
            )}

            {section === "about" && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

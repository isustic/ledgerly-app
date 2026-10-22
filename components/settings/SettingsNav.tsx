"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Database, Info, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsSectionId } from "./types";

const SECTIONS: { id: SettingsSectionId; icon: LucideIcon }[] = [
  { id: "general", icon: SlidersHorizontal },
  { id: "data", icon: Database },
  { id: "about", icon: Info },
];

export function getSectionLabel(id: SettingsSectionId): string {
  if (id === "general") return translate("General");
  if (id === "data") return translate("Data");
  return translate("About");
}

interface SettingsNavProps {
  active: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
}

/** Vertical list on large screens, horizontal scrolling strip on narrow ones. */
export function SettingsNav({ active, onChange }: SettingsNavProps) {
  useLanguage();

  return (
    <nav
      aria-label={translate("Settings")}
      className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:w-56 lg:shrink-0 lg:flex-col lg:self-start lg:overflow-visible lg:pb-0"
    >
      {SECTIONS.map(({ id, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              "lg:before:absolute lg:before:left-0 lg:before:top-2 lg:before:bottom-2 lg:before:w-0.5 lg:before:rounded-full",
              isActive
                ? "bg-accent text-accent-foreground lg:before:bg-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "opacity-70")} />
            {getSectionLabel(id)}
          </button>
        );
      })}
    </nav>
  );
}

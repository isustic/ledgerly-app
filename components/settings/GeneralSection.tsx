"use client";

import { translate, setLanguage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useTheme } from "@/components/ThemeProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./SettingsCard";
import { SettingRow } from "./SettingRow";

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function GeneralSection() {
  const language = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <SettingsCard>
        <SettingRow
          label={translate("Language")}
          hint={translate("Choose the language used throughout Ledgerly.")}
          control={
            <Select value={language} onValueChange={(value) => setLanguage(value as "en" | "ro")}>
              <SelectTrigger aria-label={translate("Language")} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">
                  <span lang="en">English</span>
                </SelectItem>
                <SelectItem value="ro">
                  <span lang="ro">Română</span>
                </SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </SettingsCard>

      <SettingsCard title={translate("Appearance")}>
        <SettingRow
          label={translate("Theme")}
          hint={translate("Match your system, or always use light or dark.")}
          control={
            <div
              role="radiogroup"
              aria-label={translate("Theme")}
              className="inline-flex rounded-lg border border-border bg-muted/50 p-1"
            >
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", active && "text-primary")} />
                    {translate(label)}
                  </button>
                );
              })}
            </div>
          }
        />
      </SettingsCard>
    </div>
  );
}

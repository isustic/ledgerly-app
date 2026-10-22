"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getLanguage, initializeLanguage, LANGUAGE_STORAGE_KEY, subscribeLanguage, syncLanguage,
} from "@/lib/i18n";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeLanguage();
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) syncLanguage(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return children;
}

/** Subscribe at the component boundary so switching languages preserves forms and loaded data. */
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage, () => "en" as const);
}

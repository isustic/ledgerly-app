import romanian from "./ro.json";
import english from "./en.json";

export type Language = "en" | "ro";
export type MessageParams = Record<string, string | number>;
export const LANGUAGE_STORAGE_KEY = "ledgerly-language";
const ro: Record<string, string> = romanian;
const en: Record<string, string> = english;
let language: Language = "en";
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return language;
}

export function getLocale(): "en-US" | "ro-RO" {
  return language === "ro" ? "ro-RO" : "en-US";
}

export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Persist only a supported choice. A blocked store still permits session changes. */
export function setLanguage(next: Language) {
  if (next !== "en" && next !== "ro") return;
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Session only. */ }
  applyLanguage(next);
}

function applyLanguage(next: Language) {
  language = next;
  document.documentElement.lang = next;
  listeners.forEach(listener => listener());
}

export function initializeLanguage() {
  let saved: Language = "en";
  try {
    if (window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "ro") saved = "ro";
  } catch { /* English is the default when storage is unavailable. */ }
  applyLanguage(saved);
}

export function syncLanguage(value: string | null) {
  applyLanguage(value === "ro" ? "ro" : "en");
}

/** Only app-owned copy belongs here; dataset names, columns, values and SQL stay intact. */
export function translate(source: string, params: MessageParams = {}, target: Language = language): string {
  const template = (target === "ro" ? ro[source] : en[source]) ?? source;
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.hasOwn(params, key) ? String(params[key]) : token,
  );
}

// State and backend messages stay in their source form and are translated when displayed.
// Templates preserve arbitrary filenames, dataset names and diagnostic details verbatim.
const messagePatterns = Object.keys(ro).filter(key => /\{\w+\}/.test(key)).map(key => {
  const keys: string[] = [];
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\{(\w+)\\\}/g, (_, name: string) => { keys.push(name); return "([\\s\\S]*?)"; });
  return { key, keys, pattern: new RegExp(`^${escaped}$`) };
});

export function translateMessage(source: string): string {
  if (Object.hasOwn(ro, source) || Object.hasOwn(en, source)) return translate(source);
  for (const { key, keys, pattern } of messagePatterns) {
    const match = pattern.exec(source);
    if (match) return translate(key, Object.fromEntries(keys.map((name, index) => [name, match[index + 1]])));
  }
  return source;
}

/** Build a source-language message for React state; translateMessage localizes it on render. */
export function message(source: string, params: MessageParams = {}): string {
  return source.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.hasOwn(params, key) ? String(params[key]) : token,
  );
}

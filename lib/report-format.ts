import { getLocale } from "@/lib/i18n";

const DATE_COLUMN_PATTERN = /date|time|fecha|datum/i;
const MIN_YYYYMMDD = 19000101;
const MAX_YYYYMMDD = 21000101;
const MIN_EXCEL_SERIAL = 30000;
const MAX_EXCEL_SERIAL = 70000;
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

function isDateColumn(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "data" || lower === "datums" || DATE_COLUMN_PATTERN.test(lower);
}

function isYyyymmdd(digits: string): boolean {
  const n = Number(digits);
  return digits.length === 8 && n >= MIN_YYYYMMDD && n <= MAX_YYYYMMDD;
}

function formatYyyymmdd(digits: string): string {
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function formatExcelSerial(serial: number): string {
  return new Date(EXCEL_EPOCH_MS + serial * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Human-readable cell text. Only date-named columns are reinterpreted, so
 * product codes and quantities that happen to look like dates stay untouched.
 */
export function formatCellValue(value: unknown, column: string): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "number") {
    if (isDateColumn(column)) {
      if (isYyyymmdd(String(value))) return formatYyyymmdd(String(value));
      if (value >= MIN_EXCEL_SERIAL && value < MAX_EXCEL_SERIAL) {
        return formatExcelSerial(Math.floor(value));
      }
    }
    if (!Number.isInteger(value)) {
      return value.toLocaleString(getLocale(), { maximumFractionDigits: 2 });
    }
    return String(value);
  }

  if (typeof value === "string" && isDateColumn(column) && isYyyymmdd(value)) {
    return formatYyyymmdd(value);
  }

  return String(value);
}

/** Orders two raw cell values: numbers numerically, everything else naturally, nulls last. */
export function compareCellValues(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty || bEmpty) return Number(aEmpty) - Number(bEmpty);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

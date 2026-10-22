export interface TyReport {
  id: number;
  name: string;
  original_file_name: string;
  file_path: string;
  table_name: string;
  row_count: number;
  created_at: string;
  updated_at: string;
}

export interface TyColumn {
  id: number;
  name: string;
  display_name?: string;
  col_type: string;
  display_order: number;
}

export interface TyRow {
  _row_id: number;
  [key: string]: unknown;
}

export type TyNotifyTone = "success" | "error";

export const TY_PAGE_SIZE = 100;

export const isNumericType = (colType: string) => colType === "REAL" || colType === "INTEGER";

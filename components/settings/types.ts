export interface ColumnUsage {
  column_name: string;
  usage_count: number;
}

export interface UsageStats {
  datasets_count: number;
  reports_run: number;
  total_rows: number;
  most_used_columns: ColumnUsage[];
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface Dataset {
  id: number;
  name: string;
  file_origin: string;
  table_name: string;
  row_count: number;
  created_at: string;
}

export type SettingsSectionId = "general" | "data" | "about";

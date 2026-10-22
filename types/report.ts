// Query state types
export interface SimpleQuery {
  datasetId: number;
  displayColumns: string[];
  groupBy: string[];
  calculations: Calculation[];
  filters: Filter[];
  sortBy: SortColumn[];
  limit: number | null;
  chartConfig?: ChartConfig;
}

// Chart types
export type ChartType = "bar" | "column" | "line" | "pie" | "area";

export interface ChartConfig {
  enabled: boolean;
  type: ChartType;
  title?: string;
}

export interface Calculation {
  function: "sum" | "count" | "avg" | "min" | "max";
  column: string;
  alias: string;
}

export interface Filter {
  column: string;
  operator: string;
  value: string;
}

export interface SortColumn {
  column: string;
  descending: boolean;
}

// Metadata types
export interface Dataset {
  id: number;
  name: string;
}

export interface ColumnMeta {
  id: number;
  name: string;
  col_type: string; // "INTEGER", "REAL", "TEXT"
}

export interface Template {
  id: number;
  name: string;
  dataset_id: number | null;
  config_json: string;
}

// Result types
export interface ReportResult {
  rows: Record<string, unknown>[];
  queryTime: number;
  rowCount: number;
}

// UI State for column-level sort (used in results view)
export interface ColumnSort {
  column: string | null
  direction: 'asc' | 'desc' | null
}

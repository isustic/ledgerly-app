import type { ChartType } from "@/types/report";

// Green-led series palette; matches the --chart-* tokens in app/globals.css.
export const SERIES_COLORS = [
  "#1f7a5c", "#2563eb", "#d97706", "#0f766e",
  "#64748b", "#9333ea", "#dc2626", "#0891b2",
];

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

/**
 * Transform query results into chart-friendly format for Recharts
 */
export function transformDataForChart(
  rows: Record<string, unknown>[],
  groupBy: string[],
  calculations: Array<{ function: string; column: string; alias: string }>,
  chartType: ChartType
): {
  data: ChartDataPoint[];
  xAxisKey: string;
  series: Array<{ key: string; name: string; color: string }>;
} {
  if (rows.length === 0) {
    return {
      data: [],
      xAxisKey: "",
      series: [],
    };
  }

  // Determine X-axis column
  let xAxisKey: string;
  if (groupBy.length > 0) {
    xAxisKey = groupBy[0];
  } else {
    // Use first column that's not a calculation result
    const firstCol = Object.keys(rows[0])[0];
    xAxisKey = firstCol;
  }

  // Determine Y-axis columns (data series)
  let seriesKeys: string[] = [];

  if (calculations.length > 0) {
    // Use calculation aliases as series
    seriesKeys = calculations.map((c) => c.alias || `${c.function}_${c.column}`);
  } else {
    // Find numeric columns (excluding X-axis)
    const numericCols = Object.keys(rows[0]).filter((key) => {
      if (key === xAxisKey) return false;
      const value = rows[0][key];
      return typeof value === "number";
    });
    seriesKeys = numericCols.length > 0 ? numericCols : [Object.keys(rows[0])[1] || "value"];
  }

  // Transform data
  const data: ChartDataPoint[] = rows.map((row) => {
    const point: ChartDataPoint = {
      name: String(row[xAxisKey] || ""),
      value: 0,
    };

    // Add all series values
    seriesKeys.forEach((key, index) => {
      const val = row[key];
      point[key] = typeof val === "number" ? val : 0;
      if (index === 0) {
        point.value = typeof val === "number" ? val : 0;
      }
    });

    return point;
  });

  // Define series with colors
  const colors = SERIES_COLORS;

  const series = seriesKeys.map((key, index) => ({
    key,
    name: key,
    color: colors[index % colors.length],
  }));

  return {
    data,
    xAxisKey,
    series,
  };
}

/**
 * Get recommended chart type based on data structure
 */
export function getRecommendedChartType(
  groupByLength: number,
  calculationsLength: number,
  rowCount: number
): ChartType {
  // Pie charts work best with single group, single calculation
  if (groupByLength === 1 && calculationsLength === 1 && rowCount <= 10) {
    return "pie";
  }

  // Line charts for time-series or many data points
  if (rowCount > 20) {
    return "line";
  }

  // Default to bar for most grouped data
  if (groupByLength > 0) {
    return "bar";
  }

  // Column for ungrouped data
  return "column";
}

/**
 * Check if chart is supported for given data
 */
export function isChartSupported(
  rows: Record<string, unknown>[],
  groupBy: string[],
  calculations: Array<{ function: string; column: string; alias: string }>
): { supported: boolean; reason?: string } {
  if (rows.length === 0) {
    return { supported: false, reason: "No data to display" };
  }

  if (rows.length === 1) {
    return { supported: false, reason: "Need at least 2 rows for a chart" };
  }

  // Check if we have numeric data
  const hasNumeric = rows.some((row) =>
    Object.values(row).some((v) => typeof v === "number")
  );

  if (!hasNumeric) {
    return { supported: false, reason: "No numeric values to plot" };
  }

  return { supported: true };
}

/**
 * Get chart type description for UI
 */
export function getChartTypeDescription(type: ChartType): string {
  const descriptions: Record<ChartType, string> = {
    bar: "Best for comparing values across categories",
    column: "Vertical bars for comparing values",
    line: "Best for trends over time or ordered data",
    pie: "Best for showing parts of a whole (single series)",
    area: "Like line chart but filled area underneath",
  };

  return descriptions[type];
}

import { translate, getLocale } from "@/lib/i18n";
import { SimpleQuery, ColumnMeta } from "@/types/report";

interface OperatorMap {
  [key: string]: string;
}

const OPERATOR_WORDS: OperatorMap = {
  "is": "equals",
  "is not": "does not equal",
  "contains": "contains",
  "starts with": "starts with",
  "ends with": "ends with",
  "equals": "equals",
  "not equal": "does not equal",
  "greater than": "greater than",
  "less than": "less than",
  "before": "before",
  "after": "after",
};

const FUNCTION_WORDS: { [key: string]: string } = {
  "sum": "Sum of",
  "count": "Count of",
  "avg": "Average of",
  "min": "Minimum of",
  "max": "Maximum of",
};

export function buildQueryPreview(
  query: SimpleQuery,
  columns: ColumnMeta[]
): string {
  const parts: string[] = [translate("Show")];

  // Determine what we're showing
  const hasGrouping = query.groupBy.length > 0;

  if (hasGrouping) {
    // Show grouping columns first
    const groupCols = query.groupBy.join(", ");
    parts.push(groupCols);

    // Add calculations
    if (query.calculations.length > 0) {
      const calcText = query.calculations
        .map(c => `${translate(FUNCTION_WORDS[c.function] || c.function)} ${c.alias}`)
        .join(", ");
      parts.push(calcText);
    } else {
      parts.push(translate("count"));
    }
  } else {
    // No grouping - just display columns
    const displayCols = query.displayColumns.length > 0
      ? query.displayColumns.join(", ")
      : columns.map(c => c.name).join(", ");
    parts.push(displayCols);
  }

  // Grouping
  if (hasGrouping) {
    parts.push(translate("grouped by {0}", { 0: query.groupBy.join(", ") }));
  }

  // Filters
  if (query.filters.length > 0) {
    const filterText = query.filters
      .map(f => {
        const op = translate(OPERATOR_WORDS[f.operator] || f.operator);
        return `${f.column} ${op} ${f.value}`;
      })
      .join(translate(" and "));
    parts.push(translate("where {0}", { 0: filterText }));
  }

  // Sort
  if (query.sortBy.length > 0) {
    const sortText = query.sortBy
      .map(s => `${s.column} (${translate(s.descending ? "descending" : "ascending")})`)
      .join(translate(", then by "));
    parts.push(translate("sorted by {0}", { 0: sortText }));
  }

  // Limit
  if (query.limit) {
    parts.push(translate("limited to {0} rows", { 0: query.limit.toLocaleString(getLocale()) }));
  }

  return parts.join(", ") + ".";
}

export function getColumnType(column: string, columns: ColumnMeta[]): "text" | "number" | "date" {
  const col = columns.find(c => c.name === column);
  if (!col) return "text";

  const colNameLower = column.toLowerCase();

  // Check for date columns FIRST (by name pattern)
  // Supports: date, time, data (PT), fecha (ES), datum (DE), datum (NL)
  if (colNameLower.includes("date") || colNameLower.includes("time") ||
      colNameLower === "data" || colNameLower.includes("fecha")) {
    return "date";
  }

  const type = col.col_type.toUpperCase();
  if (type === "INTEGER" || type === "REAL") return "number";
  return "text";
}

export function getOperatorsForType(columnType: "text" | "number" | "date"): Array<{ value: string; label: string }> {
  switch (columnType) {
    case "text":
      return [
        { value: "is", label: "is" },
        { value: "is not", label: "is not" },
        { value: "contains", label: "contains" },
        { value: "starts with", label: "starts with" },
        { value: "ends with", label: "ends with" },
      ];
    case "number":
      return [
        { value: "equals", label: "equals" },
        { value: "not equal", label: "not equal" },
        { value: "greater than", label: "greater than" },
        { value: "less than", label: "less than" },
      ];
    case "date":
      return [
        { value: "is", label: "is" },
        { value: "before", label: "before" },
        { value: "after", label: "after" },
      ];
  }
}

export function getAggregationOptions(): Array<{ value: string; label: string }> {
  return [
    { value: "sum", label: "Sum of..." },
    { value: "count", label: "Count of..." },
    { value: "avg", label: "Average of..." },
    { value: "min", label: "Minimum of..." },
    { value: "max", label: "Maximum of..." },
  ];
}

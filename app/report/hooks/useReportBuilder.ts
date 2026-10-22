"use client";

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  Calculation,
  ChartConfig,
  ColumnMeta,
  Dataset,
  Filter,
  ReportResult,
  SimpleQuery,
  SortColumn,
  Template,
} from "@/types/report";

export const EMPTY_QUERY: SimpleQuery = {
  datasetId: 0,
  displayColumns: [],
  groupBy: [],
  calculations: [],
  filters: [],
  sortBy: [],
  limit: null,
};

export interface TableSort {
  column: string;
  direction: "asc" | "desc";
}

/** The shape the Rust `run_report` command expects. Chart settings never reach the backend. */
export function buildBackendQuery(query: SimpleQuery) {
  return {
    datasetId: query.datasetId,
    displayColumns: query.displayColumns,
    groupBy: query.groupBy,
    calculations: query.calculations.map(({ function: fn, column, alias }) => ({ function: fn, column, alias })),
    filters: query.filters.map(({ column, operator, value }) => ({ column, operator, value })),
    sortBy: query.sortBy.map(({ column, descending }) => ({ column, descending })),
    limit: query.limit,
  };
}

/** Column order in the results is cosmetic, so it must not make a finished report look stale. */
function runKeyFor(query: SimpleQuery): string {
  const backend = buildBackendQuery(query);
  return JSON.stringify({ ...backend, displayColumns: [...backend.displayColumns].sort() });
}

export function useReportBuilder(preselectedDatasetId: number | null) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [query, setQuery] = useState<SimpleQuery>(EMPTY_QUERY);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateName, setActiveTemplateName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [result, setResult] = useState<ReportResult | null>(null);
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [lastRunKey, setLastRunKey] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<TableSort | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------- data loading

  const loadTemplates = useCallback(async (datasetId: number) => {
    try {
      setTemplates(await invoke<Template[]>("list_templates", { datasetId }));
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }, []);

  // The dataset named in the URL wins on first load; otherwise the first dataset is used.
  const [requestedDatasetId] = useState(preselectedDatasetId);

  useEffect(() => {
    invoke<Dataset[]>("list_datasets")
      .then((ds) => {
        setDatasets(ds);
        const requested = ds.find((d) => d.id === requestedDatasetId);
        const initial = requested ?? ds[0];
        if (initial) setActiveDatasetId(initial.id);
      })
      .catch((err) => console.error("Failed to load datasets:", err));
  }, [requestedDatasetId]);

  // Switching datasets starts a fresh report on that dataset.
  useEffect(() => {
    if (activeDatasetId === null) return;

    invoke<Template[]>("list_templates", { datasetId: activeDatasetId })
      .then(setTemplates)
      .catch((err) => console.error("Failed to load templates:", err));

    invoke<ColumnMeta[]>("get_columns", { datasetId: activeDatasetId })
      .then((cols) => {
        setColumns(cols);
        setQuery({ ...EMPTY_QUERY, datasetId: activeDatasetId, displayColumns: cols.map((c) => c.name) });
        setResult(null);
        setResultColumns([]);
        setError(null);
        setLastRunKey(null);
        setTableSort(null);
        setActiveTemplateName(null);
        setActionError(null);
      })
      .catch((err) => console.error("Failed to load columns:", err));
  }, [activeDatasetId]);

  // ---------------------------------------------------------------- running

  const runReport = useCallback(
    async (config: SimpleQuery) => {
      if (activeDatasetId === null || config.displayColumns.length === 0) return;

      const runQuery = { ...config, datasetId: activeDatasetId };
      const runKey = runKeyFor(runQuery);
      const startedAt = performance.now();

      setIsLoading(true);
      setError(null);
      setTableSort(null);

      try {
        const rows = await invoke<Record<string, unknown>[]>("run_report", {
          query: buildBackendQuery(runQuery),
        });
        setResult({
          rows,
          queryTime: Math.round(performance.now() - startedAt),
          rowCount: rows.length,
        });
        setResultColumns(rows.length > 0 ? Object.keys(rows[0]) : []);
        setLastRunKey(runKey);
      } catch (err) {
        setResult(null);
        setError(String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [activeDatasetId],
  );

  const runCurrent = useCallback(() => runReport(query), [runReport, query]);

  const isStale = result !== null && activeDatasetId !== null && lastRunKey !== runKeyFor(query);

  // ---------------------------------------------------------------- query edits

  const toggleColumn = useCallback((column: string) => {
    setQuery((prev) => {
      const displayColumns = prev.displayColumns.includes(column)
        ? prev.displayColumns.filter((c) => c !== column)
        : [...prev.displayColumns, column];
      return {
        ...prev,
        displayColumns,
        groupBy: prev.groupBy.filter((c) => displayColumns.includes(c)),
        calculations: prev.calculations.filter((c) => displayColumns.includes(c.column)),
        sortBy: prev.sortBy.filter((s) => displayColumns.includes(s.column)),
      };
    });
  }, []);

  const selectAllColumns = useCallback(() => {
    setQuery((prev) => ({ ...prev, displayColumns: columns.map((c) => c.name) }));
  }, [columns]);

  const selectNoneColumns = useCallback(() => {
    setQuery((prev) => ({ ...prev, displayColumns: [], groupBy: [], calculations: [], sortBy: [] }));
  }, []);

  const addGroup = useCallback((column: string) => {
    setQuery((prev) =>
      prev.groupBy.includes(column) ? prev : { ...prev, groupBy: [...prev.groupBy, column] },
    );
  }, []);

  const removeGroup = useCallback((column: string) => {
    setQuery((prev) => ({
      ...prev,
      groupBy: prev.groupBy.filter((c) => c !== column),
      sortBy: prev.sortBy.filter((s) => s.column !== column),
    }));
  }, []);

  const addCalculation = useCallback((calc: Calculation) => {
    setQuery((prev) => ({ ...prev, calculations: [...prev.calculations, calc] }));
  }, []);

  const removeCalculation = useCallback((index: number) => {
    setQuery((prev) => ({ ...prev, calculations: prev.calculations.filter((_, i) => i !== index) }));
  }, []);

  const renameCalculation = useCallback((index: number, alias: string) => {
    setQuery((prev) => ({
      ...prev,
      calculations: prev.calculations.map((c, i) => (i === index ? { ...c, alias } : c)),
    }));
  }, []);

  const addFilter = useCallback((filter: Filter) => {
    setQuery((prev) => ({ ...prev, filters: [...prev.filters, filter] }));
  }, []);

  const removeFilter = useCallback((index: number) => {
    setQuery((prev) => ({ ...prev, filters: prev.filters.filter((_, i) => i !== index) }));
  }, []);

  const addSort = useCallback((sort: SortColumn) => {
    setQuery((prev) => ({ ...prev, sortBy: [...prev.sortBy, sort] }));
  }, []);

  const removeSort = useCallback((index: number) => {
    setQuery((prev) => ({ ...prev, sortBy: prev.sortBy.filter((_, i) => i !== index) }));
  }, []);

  const toggleSortDirection = useCallback((index: number) => {
    setQuery((prev) => ({
      ...prev,
      sortBy: prev.sortBy.map((s, i) => (i === index ? { ...s, descending: !s.descending } : s)),
    }));
  }, []);

  const setLimit = useCallback((limit: number | null) => {
    setQuery((prev) => ({ ...prev, limit }));
  }, []);

  const setChartConfig = useCallback((update: Partial<ChartConfig>) => {
    setQuery((prev) => ({
      ...prev,
      chartConfig: { enabled: false, type: "bar", ...prev.chartConfig, ...update },
    }));
  }, []);

  /** Results can be reordered visually; on ungrouped reports the order also becomes the query's column order. */
  const reorderResultColumns = useCallback((order: string[]) => {
    setResultColumns(order);
    setQuery((prev) => (prev.groupBy.length === 0 ? { ...prev, displayColumns: order } : prev));
  }, []);

  // ---------------------------------------------------------------- saved reports

  const saveTemplate = useCallback(
    async (name: string) => {
      if (activeDatasetId === null) return;
      setActionError(null);
      try {
        await invoke("save_template", {
          name,
          datasetId: activeDatasetId,
          configJson: JSON.stringify(query),
        });
        setActiveTemplateName(name);
        await loadTemplates(activeDatasetId);
      } catch (err) {
        setActionError(String(err));
      }
    },
    [activeDatasetId, query, loadTemplates],
  );

  const deleteTemplate = useCallback(
    async (template: Template) => {
      if (activeDatasetId === null) return;
      setActionError(null);
      try {
        await invoke("delete_template", { id: template.id });
        if (activeTemplateName === template.name) setActiveTemplateName(null);
        await loadTemplates(activeDatasetId);
      } catch (err) {
        setActionError(String(err));
      }
    },
    [activeDatasetId, activeTemplateName, loadTemplates],
  );

  /** Opening a saved report loads its definition and runs it straight away. */
  const openTemplate = useCallback(
    (template: Template) => {
      let saved: SimpleQuery;
      try {
        saved = { ...EMPTY_QUERY, ...JSON.parse(template.config_json) } as SimpleQuery;
      } catch (err) {
        setActionError(String(err));
        return;
      }
      setActionError(null);
      setQuery(saved);
      setActiveTemplateName(template.name);
      runReport(saved);
    },
    [runReport],
  );

  return {
    datasets,
    activeDatasetId,
    setActiveDatasetId,
    columns,
    query,

    templates,
    activeTemplateName,
    actionError,
    saveTemplate,
    deleteTemplate,
    openTemplate,

    result,
    resultColumns,
    tableSort,
    setTableSort,
    isLoading,
    error,
    isStale,
    runCurrent,
    reorderResultColumns,

    toggleColumn,
    selectAllColumns,
    selectNoneColumns,
    addGroup,
    removeGroup,
    addCalculation,
    removeCalculation,
    renameCalculation,
    addFilter,
    removeFilter,
    addSort,
    removeSort,
    toggleSortDirection,
    setLimit,
    setChartConfig,
  };
}

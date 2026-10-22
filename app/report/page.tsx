"use client";

import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { invoke } from "@tauri-apps/api/core";
import { BarChart3, Table2, X, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { translate, getLanguage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { exportChartAsImage, base64ToUint8Array } from "@/lib/chart-export";
import { buildQueryPreview } from "@/lib/query-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useResizableSidebar } from "./hooks/useResizableSidebar";
import { useReportBuilder } from "./hooks/useReportBuilder";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ResultsPane, formatRowCount } from "@/components/report/ResultsPane";
import { ChartPane } from "@/components/report/ChartPane";
import { ResizeHandle } from "@/components/report/ResizeHandle";
import { ColumnsSection } from "@/components/report/sections/ColumnsSection";
import { GroupBySection } from "@/components/report/sections/GroupBySection";
import { CalculationsSection } from "@/components/report/sections/CalculationsSection";
import { FiltersSection } from "@/components/report/sections/FiltersSection";
import { SortSection } from "@/components/report/sections/SortSection";

type View = "table" | "chart";

function ReportPageContent() {
  useLanguage();
  const searchParams = useSearchParams();
  const datasetParam = Number(searchParams.get("dataset"));
  const preselectedDatasetId = searchParams.get("dataset") && Number.isFinite(datasetParam) ? datasetParam : null;

  const builder = useReportBuilder(preselectedDatasetId);
  const {
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
  } = builder;

  const { sidebarWidth, isDragging, dragHandleProps } = useResizableSidebar({
    minWidth: 300,
    maxWidth: 480,
    defaultWidth: 340,
    storageKey: "report-sidebar-width",
  });

  const [view, setView] = useState<View>("table");
  const [exportError, setExportError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const chartEnabled = query.chartConfig?.enabled ?? false;
  const canRun = activeDatasetId !== null && query.displayColumns.length > 0;

  // Cmd/Ctrl+Enter runs the report from anywhere on the page.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canRun && !isLoading) {
        e.preventDefault();
        runCurrent();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canRun, isLoading, runCurrent]);

  // Without a chart on screen, export renders one off-screen so it can still be captured.
  const showChartView = view === "chart" && result !== null && !isLoading && !error;

  const handleExport = async () => {
    if (!result || result.rows.length === 0) return;
    setExportError(null);

    let chartImage: number[] | null = null;
    const chartNode = chartRef.current;
    if (chartEnabled && chartNode) {
      const previousOpacity = chartNode.style.opacity;
      try {
        chartNode.style.opacity = "1";
        const base64 = await exportChartAsImage(chartNode);
        chartImage = Array.from(base64ToUint8Array(base64));
      } catch (err) {
        console.error("Chart capture failed, exporting the table only:", err);
      } finally {
        chartNode.style.opacity = previousOpacity;
      }
    }

    try {
      await invoke("export_report", {
        language: getLanguage(),
        rows: result.rows,
        columns: resultColumns,
        templateName: activeTemplateName,
        chartImage,
      });
    } catch (err) {
      if (String(err) !== "Export cancelled") setExportError(String(err));
    }
  };

  const panelStyle = { "--panel-width": `${sidebarWidth}px` } as CSSProperties;
  const sortLabel = tableSort
    ? `${tableSort.column} · ${tableSort.direction === "asc" ? translate("Ascending") : translate("Descending")}`
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-background lg:overflow-hidden">
      <ReportHeader
        datasets={datasets}
        activeDatasetId={activeDatasetId}
        onDatasetChange={setActiveDatasetId}
        templates={templates}
        activeTemplateName={activeTemplateName}
        onOpenTemplate={openTemplate}
        onDeleteTemplate={deleteTemplate}
        onSave={saveTemplate}
        canSave={canRun}
        canRun={canRun}
        isRunning={isLoading}
        onRun={runCurrent}
        canExport={Boolean(result && result.rows.length > 0)}
        onExport={handleExport}
        actionError={actionError}
      />

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <aside
          className={cn(
            "group relative flex w-full shrink-0 flex-col border-b border-border/60 bg-sidebar lg:min-h-0 lg:w-(--panel-width) lg:border-r lg:border-b-0",
            isDragging && "select-none",
          )}
          style={panelStyle}
        >
          <ScrollArea className="lg:min-h-0 lg:flex-1">
            <div className="space-y-3 p-4">
              <ColumnsSection
                columns={columns}
                selected={query.displayColumns}
                onToggle={toggleColumn}
                onSelectAll={selectAllColumns}
                onSelectNone={selectNoneColumns}
              />
              <GroupBySection
                selected={query.displayColumns}
                groupBy={query.groupBy}
                onAdd={addGroup}
                onRemove={removeGroup}
              />
              <CalculationsSection
                columns={columns}
                calculations={query.calculations}
                hasGrouping={query.groupBy.length > 0}
                onAdd={addCalculation}
                onRemove={removeCalculation}
                onRename={renameCalculation}
              />
              <FiltersSection columns={columns} filters={query.filters} onAdd={addFilter} onRemove={removeFilter} />
              <SortSection
                columns={columns}
                displayColumns={query.displayColumns}
                groupBy={query.groupBy}
                calculations={query.calculations}
                sortBy={query.sortBy}
                onAdd={addSort}
                onRemove={removeSort}
                onToggleDirection={toggleSortDirection}
                limit={query.limit}
                onLimitChange={setLimit}
              />
            </div>
          </ScrollArea>
          <ResizeHandle {...dragHandleProps} isDragging={isDragging} />
        </aside>

        <section className="flex min-h-[70vh] min-w-0 flex-1 flex-col gap-3 p-4 lg:min-h-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
              <ViewButton active={view === "table"} onClick={() => setView("table")} icon={Table2} label={translate("Table")} />
              <ViewButton active={view === "chart"} onClick={() => setView("chart")} icon={BarChart3} label={translate("Chart")} />
            </div>

            {result && (
              <div className="font-data flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatRowCount(result.rowCount)}</span>
                <span aria-hidden="true">·</span>
                <span>{result.queryTime} ms</span>
              </div>
            )}

            {sortLabel && (
              <button
                type="button"
                onClick={() => setTableSort(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors duration-150 hover:bg-primary/15"
              >
                {translate("Sorted by {0}", { 0: sortLabel })}
                <X className="h-3 w-3" />
              </button>
            )}

            {isStale && (
              <div className="ml-auto flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 py-1 pl-3 pr-1 text-xs text-warning">
                {translate("Settings changed since the last run")}
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={runCurrent} disabled={!canRun || isLoading}>
                  <RefreshCw className="h-3 w-3" />
                  {translate("Run again")}
                </Button>
              </div>
            )}
          </div>

          {exportError && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{exportError}</AlertDescription>
            </Alert>
          )}

          <div className="flex min-h-0 flex-1 flex-col">
            {showChartView ? (
              <ChartPane
                result={result}
                groupBy={query.groupBy}
                calculations={query.calculations}
                config={query.chartConfig}
                onChange={setChartConfig}
                containerRef={chartRef}
              />
            ) : (
              <ResultsPane
                result={result}
                columns={resultColumns}
                isLoading={isLoading}
                error={error}
                canRun={canRun}
                tableSort={tableSort}
                onTableSort={setTableSort}
                onReorder={reorderResultColumns}
                onRun={runCurrent}
              />
            )}
          </div>
        </section>
      </div>

      {chartEnabled && result && !showChartView && (
        <div className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0" aria-hidden="true">
          <ChartPane
            variant="export"
            result={result}
            groupBy={query.groupBy}
            calculations={query.calculations}
            config={query.chartConfig}
            onChange={setChartConfig}
            containerRef={chartRef}
          />
        </div>
      )}

      <details className="group border-t border-border/60 bg-card/60 px-6 py-2.5 text-xs">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-muted-foreground select-none">
          <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" />
          {translate("Query preview")}
        </summary>
        <p className="pt-2 leading-relaxed text-muted-foreground">{buildQueryPreview(query, columns)}</p>
      </details>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Table2;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", active && "text-primary")} />
      {label}
    </button>
  );
}

export default function ReportPage() {
  useLanguage();
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <ReportPageContent />
    </Suspense>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { invoke } from "@tauri-apps/api/core";
import { exportChartAsImage, base64ToUint8Array } from "@/lib/chart-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Database,
  BookOpen,
  Trash2,
  Save,
  Loader2,
  Settings2,
  Sparkles,
  X,
  Search
} from "lucide-react";

// Types
import type {
  Dataset,
  ColumnMeta,
  Template,
  SimpleQuery,
  Filter,
  Calculation,
  SortColumn,
  ReportResult,
  ChartConfig
} from "@/types/report";

// Step components
import { StepNavigation, StepType } from "@/components/report/StepNavigation";
import { Step1_Columns } from "@/components/report/steps/Step1_Columns";
import { Step2_GroupBy } from "@/components/report/steps/Step2_GroupBy";
import { Step3_Calculations } from "@/components/report/steps/Step3_Calculations";
import { Step4_Filters } from "@/components/report/steps/Step4_Filters";
import { Step5_Sort } from "@/components/report/steps/Step5_Sort";
import { Step6_Results } from "@/components/report/steps/Step6_Results";
import { Step7_Charts } from "@/components/report/steps/Step7_Charts";

// Query preview
import { QueryPreview } from "@/components/report/QueryPreview";
import { buildQueryPreview } from "@/lib/query-preview";

// Resizable sidebar
import { useResizableSidebar } from "./hooks/useResizableSidebar";
import { ResizeHandle } from "@/components/report/ResizeHandle";

function ReportPageContent() {
  const searchParams = useSearchParams();

  // ============================================================
  // STATE
  // ============================================================

  // Dataset state
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);

  // Query state
  const [query, setQuery] = useState<SimpleQuery>({
    datasetId: 0,
    displayColumns: [],
    groupBy: [],
    calculations: [],
    filters: [],
    sortBy: [],
    limit: null,
  });

  // UI state
  const [currentStep, setCurrentStep] = useState<StepType>("columns");
  const [completedSteps, setCompletedSteps] = useState<Set<StepType>>(new Set());

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");

  // Filter templates based on search
  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase())
  );

  // Results state
  const [result, setResult] = useState<ReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [resultTemplateName, setResultTemplateName] = useState<string | null>(null);

  // Chart state
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    enabled: false,
    type: "bar",
  });

  // Column sort state (for results table inline sort)
  const [columnSort, setColumnSort] = useState<{ column: string | null; direction: 'asc' | 'desc' | null }>({
    column: null,
    direction: null
  });

  // Ref for template name input
  const templateNameRef = useRef<HTMLInputElement>(null);

  // Ref for chart element (for export)
  const chartRef = useRef<HTMLDivElement>(null);

  // Resizable sidebar
  const { sidebarWidth, isDragging, dragHandleProps } = useResizableSidebar({
    minWidth: 300,
    maxWidth: 500,
    defaultWidth: 320,
    storageKey: 'report-sidebar-width',
  });

  // ============================================================
  // DATA LOADING
  // ============================================================

  // Load datasets on mount
  useEffect(() => {
    invoke<Dataset[]>("list_datasets")
      .then((ds) => {
        setDatasets(ds);
        if (ds.length > 0) {
          setActiveDatasetId(ds[0].id);
        }
      })
      .catch((err) => console.error("Failed to load datasets:", err));
  }, []);

  // Handle dataset pre-selection from URL
  useEffect(() => {
    const datasetId = searchParams.get("dataset");
    if (datasetId && datasets.length > 0) {
      const found = datasets.find((d) => d.id === Number(datasetId));
      if (found) {
        setActiveDatasetId(found.id);
      }
    }
  }, [datasets, searchParams]);

  // Load columns when dataset changes
  useEffect(() => {
    if (!activeDatasetId) return;

    invoke<ColumnMeta[]>("get_columns", { datasetId: activeDatasetId })
      .then((cols) => {
        setColumns(cols);
        // Initialize query with this dataset
        setQuery((prev) => ({
          ...prev,
          datasetId: activeDatasetId,
          displayColumns: cols.map((c) => c.name),
        }));
        // Reset completed steps
        setCompletedSteps(new Set());
        setCurrentStep("columns");
        // Clear results
        setResult(null);
        setError(null);
        // Clear search and save state
        setTemplateSearch("");
        setShowSaveInput(false);
        setTemplateName("");
        setSelectedTemplateId(null);
      })
      .catch((err) => console.error("Failed to load columns:", err));

    // Load templates for this dataset
    loadTemplates(activeDatasetId);
  }, [activeDatasetId]);

  // Focus template name input when save dialog is shown
  useEffect(() => {
    if (showSaveInput) {
      templateNameRef.current?.focus();
    }
  }, [showSaveInput]);

  const loadTemplates = async (datasetId: number) => {
    try {
      const tmpl = await invoke<Template[]>("list_templates", { datasetId });
      setTemplates(tmpl);
    } catch (e) {
      console.error("Failed to load templates:", e);
    }
  };

  // ============================================================
  // QUERY BUILDERS
  // ============================================================

  const updateQuery = (updates: Partial<SimpleQuery>) => {
    setQuery((prev) => ({ ...prev, ...updates }));
  };

  // Column handlers
  const handleToggleColumn = (column: string) => {
    setQuery((prev) => {
      const newDisplayColumns = prev.displayColumns.includes(column)
        ? prev.displayColumns.filter((c) => c !== column)
        : [...prev.displayColumns, column];

      // Remove from groupBy and calculations if deselected
      const newGroupBy = prev.groupBy.filter((c) => newDisplayColumns.includes(c));
      const newCalculations = prev.calculations.filter((c) =>
        newDisplayColumns.includes(c.column)
      );
      const newSortBy = prev.sortBy.filter((s) => newDisplayColumns.includes(s.column));

      return {
        ...prev,
        displayColumns: newDisplayColumns,
        groupBy: newGroupBy,
        calculations: newCalculations,
        sortBy: newSortBy,
      };
    });
  };

  const handleSelectAllColumns = () => {
    setQuery((prev) => ({
      ...prev,
      displayColumns: columns.map((c) => c.name),
    }));
  };

  const handleSelectNoneColumns = () => {
    setQuery((prev) => ({
      ...prev,
      displayColumns: [],
      groupBy: [],
      calculations: [],
      sortBy: [],
    }));
  };

  // GroupBy handlers
  const handleAddGroupColumn = (column: string) => {
    setQuery((prev) => ({
      ...prev,
      groupBy: [...prev.groupBy, column],
    }));
  };

  const handleRemoveGroupColumn = (column: string) => {
    setQuery((prev) => ({
      ...prev,
      groupBy: prev.groupBy.filter((c) => c !== column),
    }));
  };

  // Calculation handlers
  const handleAddCalculation = (calc: Calculation) => {
    setQuery((prev) => ({
      ...prev,
      calculations: [...prev.calculations, calc],
    }));
  };

  const handleRemoveCalculation = (index: number) => {
    setQuery((prev) => ({
      ...prev,
      calculations: prev.calculations.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateCalculation = (index: number, calc: Calculation) => {
    setQuery((prev) => ({
      ...prev,
      calculations: prev.calculations.map((c, i) => (i === index ? calc : c)),
    }));
  };

  // Filter handlers
  const handleAddFilter = (filter: Filter) => {
    setQuery((prev) => ({
      ...prev,
      filters: [...prev.filters, filter],
    }));
  };

  const handleRemoveFilter = (index: number) => {
    setQuery((prev) => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
  };

  // Sort handlers
  const handleAddSort = (sort: SortColumn) => {
    setQuery((prev) => ({
      ...prev,
      sortBy: [...prev.sortBy, sort],
    }));
  };

  const handleRemoveSort = (index: number) => {
    setQuery((prev) => ({
      ...prev,
      sortBy: prev.sortBy.filter((_, i) => i !== index),
    }));
  };

  const handleToggleSortDirection = (index: number) => {
    setQuery((prev) => ({
      ...prev,
      sortBy: prev.sortBy.map((s, i) =>
        i === index ? { ...s, descending: !s.descending } : s
      ),
    }));
  };

  const handleLimitChange = (limit: number | null) => {
    setQuery((prev) => ({ ...prev, limit }));
  };

  // Column sort handlers (for results table inline sort)
  const handleColumnSort = (column: string, direction: 'asc' | 'desc' | null) => {
    if (!activeDatasetId) return;

    setColumnSort({ column, direction })

    if (direction) {
      updateQuery({
        sortBy: [{ column, descending: direction === 'desc' }]
      })
    } else {
      updateQuery({ sortBy: [] })
    }

    // Re-run the report with new sort
    setIsLoading(true)
    setError(null)
    setResult(null)

    const startTime = performance.now()

    invoke<Record<string, unknown>[]>("run_report", {
      query: {
        datasetId: activeDatasetId,
        displayColumns: query.displayColumns,
        groupBy: query.groupBy,
        calculations: query.calculations.map((c) => ({
          function: c.function,
          column: c.column,
          alias: c.alias,
        })),
        filters: query.filters.map((f) => ({
          column: f.column,
          operator: f.operator,
          value: f.value,
        })),
        sortBy: direction ? [{ column, descending: direction === 'desc' }] : [],
        limit: query.limit,
      },
    })
      .then((rows) => {
        const queryTime = Math.round(performance.now() - startTime)
        const cols = rows.length > 0 ? Object.keys(rows[0]) : []

        setResult({
          rows,
          queryTime,
          rowCount: rows.length,
        })
        setResultColumns(cols)
        setCompletedSteps((prev) => new Set(prev).add("run"))
      })
      .catch((err) => {
        setError(String(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const handleColumnReorder = (newColumnOrder: string[]) => {
    // Update the displayed columns order
    setResultColumns(newColumnOrder)

    // For non-grouped queries, also update displayColumns in the query
    if (query.groupBy.length === 0) {
      updateQuery({ displayColumns: newColumnOrder })
    }
    // For grouped queries, we only update the display order
    // The resultColumns (groupBy + calculations) can be reordered independently
  }

  // ============================================================
  // STEP NAVIGATION
  // ============================================================

  const canGoNext = useCallback((): boolean => {
    switch (currentStep) {
      case "columns":
        return query.displayColumns.length > 0;
      case "groupBy":
        return query.groupBy.length > 0; // Now requires at least one group
      case "calculate":
        return query.calculations.length > 0; // Now requires at least one calculation
      case "filters":
        return query.filters.length > 0; // Requires at least one filter
      case "sort":
        return true; // Optional step
      case "run":
        return result !== null;
      case "charts":
        return true; // Can always navigate from charts
      default:
        return false;
    }
  }, [currentStep, query.displayColumns.length, query.groupBy.length, query.calculations.length, query.filters.length, result]);

  const canGoBack = useCallback((): boolean => {
    return currentStep !== "columns";
  }, [currentStep]);

  const handleNext = () => {
    // Mark current step as completed
    setCompletedSteps((prev) => new Set(prev).add(currentStep));

    // Move to next step
    const stepOrder: StepType[] = ["columns", "groupBy", "calculate", "filters", "sort", "run", "charts"];
    const currentIndex = stepOrder.indexOf(currentStep);

    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      setCurrentStep(nextStep);

      // If moving to run step, execute the query
      if (nextStep === "run") {
        handleRunReport();
      }
    }
  };

  const handleBack = () => {
    const stepOrder: StepType[] = ["columns", "groupBy", "calculate", "filters", "sort", "run", "charts"];
    const currentIndex = stepOrder.indexOf(currentStep);

    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleStepClick = (step: StepType) => {
    const stepOrder: StepType[] = ["columns", "groupBy", "calculate", "filters", "sort", "run", "charts"];
    const clickedIndex = stepOrder.indexOf(step);
    const currentIndex = stepOrder.indexOf(currentStep);

    // Can only go to previous steps or completed steps
    // Charts step is special: can only access after run is completed
    if (step === "charts" && !completedSteps.has("run")) {
      return; // Can't access charts without results
    }

    if (clickedIndex <= currentIndex || completedSteps.has(step)) {
      setCurrentStep(step);

      // If clicking run step and no results, execute query
      if (step === "run" && !result) {
        handleRunReport();
      }
    }
  };

  // ============================================================
  // RUN REPORT
  // ============================================================

  const handleRunReport = async (templateToRun?: Template) => {
    if (!activeDatasetId) return;

    // If a template is provided or selected, load it first
    const effectiveTemplate = templateToRun || templates.find(t => t.id === selectedTemplateId);

    let queryToUse = query;

    if (effectiveTemplate) {
      try {
        const savedQuery: SimpleQuery = JSON.parse(effectiveTemplate.config_json);
        queryToUse = savedQuery;
        setQuery(savedQuery);
        // Track which template was used for this result
        setResultTemplateName(effectiveTemplate.name);
        // Mark all steps as completed
        setCompletedSteps(new Set(["columns", "groupBy", "calculate", "filters", "sort", "run", "charts"]));
        setCurrentStep("run");
      } catch (err) {
        console.error("Failed to load template:", err);
        return;
      }
    } else {
      // Clear template name when running without a template
      setResultTemplateName(null);
      // No template selected - mark current steps as completed and move to run
      const steps: StepType[] = ["columns", "groupBy", "calculate", "filters", "sort", "run"];
      const currentIndex = steps.indexOf(currentStep);
      // Mark all steps up to current as completed
      const newCompleted = new Set(completedSteps);
      for (let i = 0; i <= currentIndex; i++) {
        newCompleted.add(steps[i]);
      }
      setCompletedSteps(newCompleted);
      setCurrentStep("run");
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const startTime = performance.now();

    try {
      // Build the query object for the backend
      const backendQuery = {
        datasetId: activeDatasetId,
        displayColumns: queryToUse.displayColumns,
        groupBy: queryToUse.groupBy,
        calculations: queryToUse.calculations.map((c) => ({
          function: c.function,
          column: c.column,
          alias: c.alias,
        })),
        filters: queryToUse.filters.map((f) => ({
          column: f.column,
          operator: f.operator,
          value: f.value,
        })),
        sortBy: queryToUse.sortBy.map((s) => ({
          column: s.column,
          descending: s.descending,
        })),
        limit: queryToUse.limit,
      };

      const rows = await invoke<Record<string, unknown>[]>("run_report", {
        query: backendQuery,
      });

      const queryTime = Math.round(performance.now() - startTime);

      // Extract columns from result
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];

      setResult({
        rows,
        queryTime,
        rowCount: rows.length,
      });
      setResultColumns(cols);

      // Mark run step as completed
      setCompletedSteps((prev) => new Set(prev).add("run"));
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // EXPORT
  // ============================================================

  const handleExport = async () => {
    if (!result || result.rows.length === 0) return;

    try {
      // Capture chart image if chart is enabled
      let chartImageBytes: Uint8Array | undefined;

      console.log("🔍 Export debug - chartConfig.enabled:", chartConfig.enabled);
      console.log("🔍 Export debug - chartRef.current:", chartRef.current);
      console.log("🔍 Export debug - chartRef.current?.innerHTML:", chartRef.current?.innerHTML?.substring(0, 200));

      if (chartConfig.enabled && chartRef.current) {
        try {
          console.log("📸 Attempting to capture chart image...");
          // Temporarily make the chart fully visible for capture
          // (html-to-image clones styles, so opacity:0 would produce a blank image)
          const prevOpacity = chartRef.current.style.opacity;
          chartRef.current.style.opacity = '1';

          const base64Image = await exportChartAsImage(chartRef.current);

          // Restore hidden state
          chartRef.current.style.opacity = prevOpacity;

          console.log("✅ Chart captured successfully, base64 length:", base64Image.length);
          chartImageBytes = base64ToUint8Array(base64Image);
          console.log("✅ Chart image bytes created, length:", chartImageBytes.length);
        } catch (error) {
          // Restore hidden state on error
          if (chartRef.current) chartRef.current.style.opacity = '0';
          console.error("❌ Failed to capture chart image, exporting without chart:", error);
          // Continue export without chart
        }
      } else {
        console.log("⚠️ Chart not enabled or ref not found, skipping chart capture");
      }

      console.log("📤 Calling export_report with chartImage:", chartImageBytes ? `YES (${chartImageBytes.length} bytes)` : "NO");

      await invoke("export_report", {
        rows: result.rows,
        columns: resultColumns,
        templateName: resultTemplateName,
        chartImage: chartImageBytes ? Array.from(chartImageBytes) : null,
      });

      console.log("✅ Export completed successfully");
    } catch (err) {
      // Don't log if user cancelled the dialog
      if (String(err) !== "Export cancelled") {
        console.error("Export failed:", err);
      }
    }
  };

  // ============================================================
  // TEMPLATES
  // ============================================================

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !activeDatasetId) return;

    try {
      await invoke("save_template", {
        name: templateName.trim(),
        datasetId: activeDatasetId,
        configJson: JSON.stringify(query),
      });

      setTemplateName("");
      setShowSaveInput(false);
      loadTemplates(activeDatasetId);
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  };

  const handleLoadTemplate = async (template: Template) => {
    try {
      const savedQuery: SimpleQuery = JSON.parse(template.config_json);

      setQuery(savedQuery);
      setCompletedSteps(new Set(["columns"]));
      setCurrentStep("groupBy");
      setSelectedTemplateId(null); // Clear selection when loading to edit

      // Clear previous results
      setResult(null);
      setError(null);
    } catch (err) {
      console.error("Failed to load template:", err);
    }
  };

  const handleSelectTemplate = (templateId: number) => {
    setSelectedTemplateId(templateId === selectedTemplateId ? null : templateId);
  };

  const handleDeleteTemplate = async (templateId: number) => {
    try {
      await invoke("delete_template", { id: templateId });
      loadTemplates(activeDatasetId!);
      // Clear selection if deleted template was selected
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  const queryPreviewText = buildQueryPreview(query, columns);

  const hasGrouping = query.groupBy.length > 0;

  // Navigation Buttons Component
  const NavigationButtons = () => (
    <div className="flex items-center justify-between mt-8 pt-4 border-t border-border/50">
      <Button
        variant="outline"
        onClick={handleBack}
        disabled={!canGoBack()}
      >
        Back
      </Button>
      <div className="text-sm text-muted-foreground">
        Step {["columns", "groupBy", "calculate", "filters", "sort", "run", "charts"].indexOf(currentStep) + 1} of 7
      </div>
      <Button onClick={handleNext} disabled={!canGoNext()}>
        {currentStep === "sort" ? "Run Report" : currentStep === "run" ? "Add chart" : "Next"}
      </Button>
    </div>
  );

  return (
    <div className="flex h-full bg-background/50">
      {/* LEFT SIDEBAR */}
      <aside
        className="group shrink-0 border-r border-border/50 bg-card flex flex-col overflow-hidden"
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Header */}
        <div className="h-14 px-4 flex items-end border-b border-border/50">
          <div>
            <h1 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Report builder
            </h1>
            <p className="text-[10px] text-muted-foreground truncate">Build queries step by step</p>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-6">
            {/* Dataset Selector */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <Database className="w-3 h-3" />
                Dataset
              </label>
              <Select
                value={String(activeDatasetId ?? "")}
                onValueChange={(v) => setActiveDatasetId(Number(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Templates */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  <BookOpen className="w-3 h-3" />
                  Saved reports
                </label>
                <button
                  onClick={() => setShowSaveInput((v) => !v)}
                  className="text-primary hover:opacity-70 transition-opacity"
                  title="Save current report"
                >
                  <Save size={13} />
                </button>
              </div>

              {showSaveInput && (
                <div className="flex gap-1.5 items-center p-2 rounded-md bg-primary/5 border border-primary/20 flex-wrap">
                  <Input
                    ref={templateNameRef}
                    className="flex-1 h-7 text-xs bg-background/60 border-border/50"
                    placeholder="Report name…"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
                  />
                  <Button size="sm" className="h-7 px-3 text-xs" onClick={handleSaveTemplate}>
                    Save
                  </Button>
                  <button
                    onClick={() => setShowSaveInput(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 py-2">No saved reports</p>
              ) : (
                <>
                  {/* Search input */}
                  <div className="relative -mx-1 px-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground z-10" />
                    <Input
                      className="h-7 pl-7 text-xs bg-muted/30 border-border/50"
                      placeholder="Search reports…"
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                    />
                    {templateSearch && (
                      <button
                        onClick={() => setTemplateSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="max-h-[224px] overflow-y-auto overflow-x-hidden">
                    <div className="space-y-0.5 pr-1">
                      {filteredTemplates.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 py-2 text-center">
                          No matching reports
                        </p>
                      ) : (
                        filteredTemplates.map((t) => (
                          <div
                            key={t.id}
                            className={cn(
                              "group flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors",
                              selectedTemplateId === t.id
                                ? "bg-primary/15 border border-primary/30"
                                : "hover:bg-muted/40 border border-transparent"
                            )}
                          >
                            <button
                              className="flex-1 text-left text-xs truncate flex items-center gap-1.5 min-w-0"
                              onClick={() => handleSelectTemplate(t.id)}
                              title="Click to select, use Run Report button below to execute"
                            >
                              <BookOpen size={11} className={cn(
                                "shrink-0",
                                selectedTemplateId === t.id ? "text-primary" : "text-muted-foreground"
                              )} />
                              <span className={cn(
                                "truncate",
                                selectedTemplateId === t.id && "font-medium text-primary"
                              )}>{t.name}</span>
                            </button>
                            <button
                              onClick={() => handleLoadTemplate(t)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity p-0.5"
                              title="Edit this report"
                            >
                              <Settings2 size={11} />
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(t.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5"
                              title="Delete this report"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Query Summary */}
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Current configuration
              </label>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Columns:</span>
                  <span className="font-medium">{query.displayColumns.length}</span>
                </div>
                {hasGrouping && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grouped by:</span>
                    <span className="font-medium">{query.groupBy.length}</span>
                  </div>
                )}
                {query.calculations.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Calculations:</span>
                    <span className="font-medium">{query.calculations.length}</span>
                  </div>
                )}
                {query.filters.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Filters:</span>
                    <span className="font-medium">{query.filters.length}</span>
                  </div>
                )}
                {query.sortBy.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sort levels:</span>
                    <span className="font-medium">{query.sortBy.length}</span>
                  </div>
                )}
                {query.limit && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Limit:</span>
                    <span className="font-medium">{query.limit.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        <div className="p-4 border-t border-border/50 space-y-2 bg-card/20">
          <Button
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleRunReport()}
            disabled={isLoading || !selectedTemplateId}
          >
            {isLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Settings2 size={13} />
            )}
            <span className="truncate">
              {isLoading ? "Running…" : selectedTemplateId ? "Run report" : "Select a report"}
            </span>
          </Button>
        </div>

        {/* Resize Handle */}
        <ResizeHandle {...dragHandleProps} isDragging={isDragging} />
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Step Navigation */}
        <div className="px-6 py-4 border-b border-border/50 bg-card/20">
          <StepNavigation
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
          />
        </div>

        {/* Step Content */}
        <ScrollArea className="flex-1 px-6 py-6">
          <div className="max-w-6xl flex flex-col">
            {currentStep === "columns" && (
              <>
                <Step1_Columns
                  columns={columns}
                  selectedColumns={query.displayColumns}
                  onColumnToggle={handleToggleColumn}
                  onSelectAll={handleSelectAllColumns}
                  onSelectNone={handleSelectNoneColumns}
                />
                <NavigationButtons />
              </>
            )}

            {currentStep === "groupBy" && (
              <>
                <Step2_GroupBy
                  columns={columns}
                  selectedColumns={query.displayColumns}
                  groupBy={query.groupBy}
                  onAddGroupColumn={handleAddGroupColumn}
                  onRemoveGroupColumn={handleRemoveGroupColumn}
                />
                <NavigationButtons />
              </>
            )}

            {currentStep === "calculate" && (
              <>
                <Step3_Calculations
                  columns={columns}
                  calculations={query.calculations}
                  onAddCalculation={handleAddCalculation}
                  onRemoveCalculation={handleRemoveCalculation}
                  onUpdateCalculation={handleUpdateCalculation}
                  hasGrouping={hasGrouping}
                />
                <NavigationButtons />
              </>
            )}

            {currentStep === "filters" && (
              <>
                <Step4_Filters
                  columns={columns}
                  filters={query.filters}
                  onAddFilter={handleAddFilter}
                  onRemoveFilter={handleRemoveFilter}
                />
                <NavigationButtons />
              </>
            )}

            {currentStep === "sort" && (
              <>
                <Step5_Sort
                  columns={columns}
                  displayColumns={query.displayColumns}
                  groupBy={query.groupBy}
                  calculations={query.calculations}
                  sortBy={query.sortBy}
                  onAddSort={handleAddSort}
                  onRemoveSort={handleRemoveSort}
                  onToggleDirection={handleToggleSortDirection}
                  limit={query.limit}
                  onLimitChange={handleLimitChange}
                />
                <NavigationButtons />
              </>
            )}

            {currentStep === "run" && (
              <Step6_Results
                result={result}
                isLoading={isLoading}
                error={error}
                onExport={handleExport}
                onRefine={() => setCurrentStep("filters")}
                onEdit={() => {
                  setCurrentStep("columns");
                  setCompletedSteps(new Set());
                  setResult(null);
                  setColumnSort({ column: null, direction: null });
                }}
                onSave={async (name) => {
                  if (!activeDatasetId) return;
                  try {
                    await invoke("save_template", {
                      name,
                      datasetId: activeDatasetId,
                      configJson: JSON.stringify(query),
                    });
                    loadTemplates(activeDatasetId);
                  } catch (err) {
                    console.error("Failed to save template:", err);
                  }
                }}
                columns={resultColumns}
                onSortChange={handleColumnSort}
                onColumnReorder={handleColumnReorder}
                currentSort={columnSort}
                onAddChart={() => setCurrentStep("charts")}
                chartEnabled={chartConfig.enabled}
              />
            )}

            <Step7_Charts
              result={result}
              resultColumns={resultColumns}
              groupBy={query.groupBy}
              calculations={query.calculations}
              chartConfig={chartConfig}
              onChartConfigChange={setChartConfig}
              onBack={() => setCurrentStep("run")}
              onExport={handleExport}
              chartRef={chartRef}
              isVisible={currentStep === "charts"}
            />
          </div>
        </ScrollArea>

        {/* Query Preview at Bottom */}
        <div className="px-6 py-3 border-t border-border/50 bg-muted/30">
          <QueryPreview query={queryPreviewText} />
        </div>
      </main>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    }>
      <ReportPageContent />
    </Suspense>
  );
}

"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect, useMemo, Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, FileSpreadsheet, Download, Calendar, Users, Upload, RotateCcw, type LucideIcon } from "lucide-react";
import { AgentList, AgentInfo } from "@/components/epp/AgentList";
import { EppReportTable, EppRow } from "@/components/epp/EppReportTable";
import { SummaryCards } from "@/components/epp/SummaryCards";
import { DatasetSelector } from "@/components/analysis/DatasetSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLastOpenedDataset, setLastOpenedDataset } from "@/lib/dataset-tracking";
import { isQualified } from "@/lib/epp";
import { cn } from "@/lib/utils";

interface Dataset {
  id: number;
  name: string;
}

interface EppReport {
  agent_name: string;
  year: number;
  rows: EppRow[];
}

function ReportSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6" aria-busy="true" aria-label={translate("Loading")}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-xl border border-border/60 bg-muted/50" />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex animate-pulse gap-6">
              <div className="h-3 w-40 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="ml-auto h-3 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md animate-fade-in flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function EProPageContent() {
  useLanguage();
  const searchParams = useSearchParams();
  const urlDatasetId = searchParams.get("dataset");

  // Dataset
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  // Agents
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Report
  const [reportData, setReportData] = useState<EppReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [clientQuery, setClientQuery] = useState("");
  const [showQualifiedOnly, setShowQualifiedOnly] = useState(false);

  // Export all
  const [exportingAll, setExportingAll] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Load datasets. Prefer the dataset in the URL, then the last one opened, then the first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDatasetError(null);
      try {
        const result = await invoke<Dataset[]>("list_datasets");
        if (cancelled) return;
        setDatasets(result);
        const fromUrl = urlDatasetId ? result.find((d) => d.id === Number(urlDatasetId)) : undefined;
        const remembered = result.find((d) => d.id === getLastOpenedDataset());
        const pick = fromUrl ?? remembered ?? result[0];
        setSelectedDatasetId(pick?.id ?? null);
      } catch (err) {
        console.error("Failed to load datasets:", err);
        if (!cancelled) {
          setDatasets([]);
          setDatasetError(String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlDatasetId, reloadKey]);

  // Load the agent list for the selected dataset.
  useEffect(() => {
    if (!selectedDatasetId) return;
    let cancelled = false;
    (async () => {
      setAgentsLoading(true);
      setAgentsError(null);
      try {
        const result = await invoke<Array<{ name: string; client_count: number }>>("get_agents_for_dataset", {
          datasetId: selectedDatasetId,
        });
        if (!cancelled) setAgents(result.map((a) => ({ name: a.name, client_count: a.client_count })));
      } catch (err) {
        console.error("Failed to load agents:", err);
        if (!cancelled) {
          setAgents([]);
          setAgentsError(String(err));
        }
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDatasetId]);

  // Generate the report for the selected agent, year and dataset.
  useEffect(() => {
    if (!selectedAgent || !selectedDatasetId) return;
    let cancelled = false;
    (async () => {
      setReportLoading(true);
      setReportError(null);
      try {
        const result = await invoke<EppReport>("generate_epp_report", {
          agentName: selectedAgent,
          year: selectedYear,
          datasetId: selectedDatasetId,
        });
        if (!cancelled) setReportData(result);
      } catch (err) {
        console.error("Failed to generate report:", err);
        if (!cancelled) {
          setReportData(null);
          setReportError(String(err));
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAgent, selectedYear, selectedDatasetId, reloadKey]);

  const handleDatasetChange = (datasetId: number) => {
    setLastOpenedDataset(datasetId);
    setSelectedDatasetId(datasetId);
    setSelectedAgent(null);
    setReportData(null);
    setReportError(null);
    setAgentSearch("");
    setClientQuery("");
  };

  const handleSelectAgent = (name: string) => {
    setSelectedAgent(name);
    setReportData(null);
    setReportError(null);
    setClientQuery("");
  };

  const handleExportAll = async () => {
    if (!selectedDatasetId) return;
    setExportingAll(true);
    setExportMessage(null);
    try {
      await invoke("export_all_epp_reports", { datasetId: selectedDatasetId, year: selectedYear });
      setExportMessage({ tone: "success", text: translate("Export finished.") });
    } catch (err) {
      console.error("Export all failed:", err);
      setExportMessage({ tone: "error", text: translate("Export failed. Please try again.") });
    } finally {
      setExportingAll(false);
    }
  };

  // Client search first, then the qualified filter. Summary cards read the same lists as the table.
  const reportRows = useMemo(() => reportData?.rows ?? [], [reportData]);
  const searchedRows = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    return query ? reportRows.filter((row) => row.client.toLowerCase().includes(query)) : reportRows;
  }, [reportRows, clientQuery]);
  const visibleRows = useMemo(
    () => (showQualifiedOnly ? searchedRows.filter(isQualified) : searchedRows),
    [searchedRows, showQualifiedOnly]
  );
  const qualifiedCount = useMemo(() => searchedRows.filter(isQualified).length, [searchedRows]);
  const totalAnual = visibleRows.reduce((sum, row) => sum + row.total_anual, 0);

  const yearOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
  const noDatasets = datasets !== null && datasets.length === 0 && !datasetError;

  const renderMain = () => {
    if (datasetError) {
      return (
        <div className="p-6">
          <Alert variant="destructive" className="py-2.5">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{translate("Couldn’t load datasets.")}</span>
              <Button variant="outline" size="sm" className="bg-background" onClick={() => setReloadKey((k) => k + 1)}>
                <RotateCcw className="h-3.5 w-3.5" />
                {translate("Try again")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    if (noDatasets) {
      return (
        <EmptyPanel
          icon={Upload}
          title={translate("No datasets yet")}
          description={translate("Import an Excel file in Raw data to generate EPro reports.")}
        >
          <Link href="/upload" className={buttonVariants({ size: "sm" })}>
            {translate("Go to Raw data")}
          </Link>
        </EmptyPanel>
      );
    }

    if (!selectedAgent) {
      return (
        <EmptyPanel
          icon={FileSpreadsheet}
          title={translate("Select an agent")}
          description={translate("Choose a dataset and an agent to generate their quarterly EPro report.")}
        />
      );
    }

    if (reportError) {
      return (
        <div className="p-6">
          <Alert variant="destructive" className="py-2.5">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{translate("Couldn’t generate the report for {agent}.", { agent: selectedAgent })}</span>
              <Button variant="outline" size="sm" className="bg-background" onClick={() => setReloadKey((k) => k + 1)}>
                <RotateCcw className="h-3.5 w-3.5" />
                {translate("Try again")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    if (reportLoading && !reportData) {
      return <ReportSkeleton />;
    }

    if (!reportData || reportData.rows.length === 0) {
      return (
        <EmptyPanel
          icon={Users}
          title={translate("No clients found for {agent}", { agent: selectedAgent })}
          description={translate("Try selecting a different agent or import more data.")}
        />
      );
    }

    return (
      <div
        aria-busy={reportLoading}
        className={cn(
          "flex flex-col gap-4 p-4 transition-opacity duration-150 xl:p-6",
          reportLoading && "opacity-60"
        )}
      >
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">
              {translate("EPro Report")} · {reportData.year}
            </p>
            <h2 className="truncate text-xl font-semibold tracking-tight">{reportData.agent_name}</h2>
          </div>
        </div>

        <SummaryCards
          className="shrink-0"
          clientCount={visibleRows.length}
          qualifiedCount={qualifiedCount}
          totalAnual={totalAnual}
          averagePerClient={visibleRows.length > 0 ? totalAnual / visibleRows.length : 0}
        />

        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <EppReportTable
            rows={visibleRows}
            totalRowCount={reportRows.length}
            agentName={reportData.agent_name}
            year={reportData.year}
            query={clientQuery}
            onQueryChange={setClientQuery}
            showQualifiedOnly={showQualifiedOnly}
            onQualifiedFilterChange={setShowQualifiedOnly}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">{translate("EPro Reports")}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {translate("Quarterly agent reports and program tiers")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DatasetSelector value={selectedDatasetId} onChange={handleDatasetChange} />

          <div className="w-[7.5rem]">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="h-9 w-full gap-2" aria-label={translate("Year")}>
                <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            className="h-9 gap-2"
            disabled={!selectedDatasetId || exportingAll}
            onClick={handleExportAll}
          >
            {exportingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exportingAll ? translate("Exporting all agents...") : translate("Export all agents")}
          </Button>
        </div>
      </header>

      {exportMessage && (
        <div
          role="status"
          className={cn(
            "shrink-0 border-b px-6 py-2 text-xs",
            exportMessage.tone === "error"
              ? "border-destructive/20 bg-destructive/10 text-destructive"
              : "border-border bg-muted/40 text-muted-foreground"
          )}
        >
          {exportMessage.text}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Agent panel */}
        <aside className="flex max-h-[40vh] shrink-0 flex-col border-b border-border/60 bg-card lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r xl:w-80">
          <AgentList
            agents={selectedDatasetId ? agents : []}
            selectedAgent={selectedAgent}
            onSelectAgent={handleSelectAgent}
            searchQuery={agentSearch}
            onSearchChange={setAgentSearch}
            isLoading={datasets === null || agentsLoading}
          />
          {agentsError && (
            <div className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {translate("Couldn’t load agents.")}
            </div>
          )}
        </aside>

        {/* Report */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{renderMain()}</main>
      </div>
    </div>
  );
}

export default function EProPage() {
  useLanguage();
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <EProPageContent />
    </Suspense>
  );
}

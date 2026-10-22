"use client";

import { translate, translateMessage } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState, useEffect, useMemo, useRef, useCallback, type KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Check,
  CheckCircle2,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { AgentList, type AgentInfo } from "@/components/epp/AgentList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ClientCombinationMember {
  client_name: string;
  client_key: string;
  display_order: number;
}

interface ClientCombination {
  id: number;
  agent_name: string;
  members: ClientCombinationMember[];
  created_at: string;
  updated_at: string;
}

const MIN_MEMBERS = 2;
const MEMBER_PREVIEW = 4;

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : typeof err === "string" && err ? err : fallback;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const comboLabel = (combo: ClientCombination) => combo.members.map((m) => m.client_name).join(" + ");

function EmptyBlock({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden="true" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-data text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
}

export default function ClientsPage() {
  useLanguage();

  // Agents
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Clients + saved combinations for the selected agent
  const [availableClients, setAvailableClients] = useState<string[]>([]);
  const [combinations, setCombinations] = useState<ClientCombination[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Builder
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClientCombination | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAgentsLoading(true);
      setAgentsError(false);
      try {
        const result = await invoke<AgentInfo[]>("list_combination_agents");
        if (!cancelled) setAgents(result);
      } catch (err) {
        console.error("Failed to load agents:", err);
        if (!cancelled) {
          setAgents([]);
          setAgentsError(true);
        }
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedAgent) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [clientsResult, combosResult] = await Promise.all([
          invoke<string[]>("list_clients_for_agent", { agentName: selectedAgent }),
          invoke<ClientCombination[]>("list_client_combinations", { agentName: selectedAgent }),
        ]);
        if (cancelled) return;
        setAvailableClients(clientsResult.filter((c) => c && c.trim()).sort((a, b) => a.localeCompare(b)));
        setCombinations(combosResult);
      } catch (err) {
        console.error("Failed to load clients:", err);
        if (cancelled) return;
        setLoadError(errorText(err, "Failed to load data"));
        setAvailableClients([]);
        setCombinations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAgent, reloadKey]);

  // The notice is a passing confirmation, not a persistent state.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const resetBuilder = useCallback(() => {
    setSelected([]);
    setEditingId(null);
    setActionError(null);
  }, []);

  const handleSelectAgent = (name: string) => {
    if (name === selectedAgent) return;
    setSelectedAgent(name);
    setAvailableClients([]);
    setCombinations([]);
    setClientQuery("");
    setNotice(null);
    resetBuilder();
  };

  // Which clients already belong to a (different) saved combination.
  const takenBy = useMemo(() => {
    const map = new Map<string, ClientCombination>();
    for (const combo of combinations) {
      if (combo.id === editingId) continue;
      for (const member of combo.members) map.set(member.client_name, combo);
    }
    return map;
  }, [combinations, editingId]);

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    return query ? availableClients.filter((c) => c.toLowerCase().includes(query)) : availableClients;
  }, [availableClients, clientQuery]);

  const combinedCount = useMemo(
    () => new Set(combinations.flatMap((combo) => combo.members.map((m) => m.client_name))).size,
    [combinations]
  );

  const toggleClient = (client: string) => {
    setActionError(null);
    setSelected((prev) => (prev.includes(client) ? prev.filter((c) => c !== client) : [...prev, client]));
  };

  const startEdit = (combo: ClientCombination) => {
    setEditingId(combo.id);
    setSelected(combo.members.map((m) => m.client_name));
    setActionError(null);
    setNotice(null);
    searchRef.current?.focus();
  };

  const canSave = selected.length >= MIN_MEMBERS && !saving;

  const handleSave = async () => {
    if (!selectedAgent) return;
    if (selected.length < MIN_MEMBERS) {
      setActionError("At least 2 clients are required");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const wasEditing = editingId !== null;
      if (editingId !== null) {
        await invoke("update_client_combination", { combinationId: editingId, clientNames: selected });
      } else {
        await invoke("create_client_combination", { agentName: selectedAgent, clientNames: selected });
      }
      const combosResult = await invoke<ClientCombination[]>("list_client_combinations", {
        agentName: selectedAgent,
      });
      setCombinations(combosResult);
      resetBuilder();
      setNotice(wasEditing ? "Combination updated" : "Combination saved");
    } catch (err) {
      console.error("Failed to save combination:", err);
      setActionError(errorText(err, "Failed to save combination"));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || !selectedAgent) return;
    setDeleting(true);
    try {
      await invoke("delete_client_combination", { combinationId: pendingDelete.id });
      const combosResult = await invoke<ClientCombination[]>("list_client_combinations", {
        agentName: selectedAgent,
      });
      setCombinations(combosResult);
      if (editingId === pendingDelete.id) resetBuilder();
      setNotice("Combination deleted");
      setPendingDelete(null);
    } catch (err) {
      console.error("Failed to delete combination:", err);
      setActionError(errorText(err, "Failed to delete"));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // Cmd/Ctrl+Enter saves; Escape leaves edit mode (or clears the selection).
  const handleBuilderKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canSave) void handleSave();
    } else if (e.key === "Escape" && !clientQuery && (editingId !== null || selected.length > 0)) {
      resetBuilder();
    }
  };

  const renderMain = () => {
    if (agentsError) {
      return (
        <div className="p-6">
          <Alert variant="destructive" className="py-2.5">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{translate("Couldn’t load agents.")}</span>
              <Button variant="outline" size="sm" className="bg-background" onClick={() => window.location.reload()}>
                <RotateCcw className="h-3.5 w-3.5" />
                {translate("Try again")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    if (!selectedAgent) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex max-w-md animate-fade-in flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Link2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{translate("No agent selected")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {translate("Select an agent from the left panel to build client combinations for EPro reporting.")}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="p-6">
          <Alert variant="destructive" className="py-2.5">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{translateMessage(loadError)}</span>
              <Button variant="outline" size="sm" className="bg-background" onClick={() => setReloadKey((k) => k + 1)}>
                <RotateCcw className="h-3.5 w-3.5" />
                {translate("Try again")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    const editing = editingId !== null;
    const remaining = Math.max(0, MIN_MEMBERS - selected.length);

    return (
      <div
        aria-busy={loading}
        className={cn(
          "flex animate-fade-in flex-col gap-4 p-4 transition-opacity duration-150 xl:p-6",
          loading && "opacity-60"
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">{translate("Client Combinations")}</p>
            <h2 className="truncate text-xl font-semibold tracking-tight">{selectedAgent}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Stat label={translate("Clients")} value={availableClients.length} dot="bg-sky-500" />
            <Stat label={translate("Combined")} value={combinedCount} dot="bg-emerald-500" />
            <Stat
              label={translate("Available")}
              value={Math.max(0, availableClients.length - combinedCount)}
              dot="bg-amber-500"
            />
          </div>
        </div>

        {(actionError || notice) && (
          <div role={actionError ? "alert" : "status"}>
            {actionError ? (
              <Alert variant="destructive" className="py-2.5">
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>{translateMessage(actionError)}</span>
                  <button
                    type="button"
                    onClick={() => setActionError(null)}
                    aria-label={translate("Dismiss")}
                    className="rounded p-0.5 hover:bg-destructive/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" />
                {translate(notice as string)}
              </div>
            )}
          </div>
        )}

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Builder */}
          <section
            onKeyDown={handleBuilderKeyDown}
            aria-label={editing ? translate("Edit combination") : translate("New combination")}
            className={cn(
              "flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-colors",
              editing ? "border-primary/50 ring-2 ring-primary/15" : "border-border"
            )}
          >
            <div className="space-y-3 border-b border-border/60 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {editing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </div>
                  <h3 className="text-sm font-semibold">
                    {editing ? translate("Edit combination") : translate("New combination")}
                  </h3>
                </div>
                <span className="font-data text-[11px] text-muted-foreground tabular-nums">
                  {filteredClients.length}/{availableClients.length}
                </span>
              </div>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  ref={searchRef}
                  type="text"
                  aria-label={translate("Search clients")}
                  placeholder={translate("Search clients...")}
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && clientQuery) {
                      e.stopPropagation();
                      setClientQuery("");
                    }
                  }}
                  className="h-9 pl-9 pr-9 text-sm"
                />
                {clientQuery && (
                  <button
                    type="button"
                    onClick={() => setClientQuery("")}
                    aria-label={translate("Clear search")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div role="group" aria-label={translate("Clients")} className="max-h-[22rem] min-h-40 overflow-y-auto p-2">
              {loading && availableClients.length === 0 ? (
                <div className="space-y-1.5 p-1" aria-label={translate("Loading...")}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="flex animate-pulse items-center gap-3 rounded-lg px-3 py-2.5">
                      <div className="h-7 w-7 rounded-full bg-muted" />
                      <div className="h-3.5 w-44 rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : availableClients.length === 0 ? (
                <EmptyBlock
                  icon={Users}
                  title={translate("No clients found")}
                  description={translate("This agent has no clients yet. Import more data to see them here.")}
                />
              ) : filteredClients.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    {translate("No clients match “{query}”", { query: clientQuery })}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setClientQuery("")}>
                    {translate("Clear search")}
                  </Button>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {filteredClients.map((client) => {
                    const isSelected = selected.includes(client);
                    const owner = takenBy.get(client);
                    const disabled = Boolean(owner) && !isSelected;
                    return (
                      <li key={client}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          disabled={disabled}
                          title={owner ? comboLabel(owner) : undefined}
                          onClick={() => toggleClient(client)}
                          className={cn(
                            "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
                            disabled && "cursor-not-allowed opacity-60 hover:bg-transparent"
                          )}
                        >
                          {isSelected && (
                            <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />
                          )}
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}
                            aria-hidden="true"
                          >
                            {isSelected ? <Check className="h-3.5 w-3.5" /> : initials(client)}
                          </span>
                          <span className={cn("min-w-0 flex-1 truncate text-sm", isSelected && "font-semibold")}>
                            {client}
                          </span>
                          {owner && !isSelected && (
                            <span className="flex max-w-[45%] shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              <Link2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{translate("Already combined")}</span>
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Selection + actions */}
            <div className="space-y-3 border-t border-border/60 bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {translate(selected.length === 1 ? "{count} client selected" : "{count} clients selected", {
                    count: selected.length,
                  })}
                </p>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelected([])}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {translate("Clear")}
                  </button>
                )}
              </div>

              {selected.length > 0 ? (
                <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {selected.map((client) => (
                    <span
                      key={client}
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary"
                    >
                      <span className="truncate">{client}</span>
                      <button
                        type="button"
                        onClick={() => toggleClient(client)}
                        aria-label={translate("Remove {name}", { name: client })}
                        className="rounded-full p-0.5 hover:bg-primary/15"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {translate("Pick at least 2 clients to report them together.")}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {remaining > 0 && selected.length > 0
                    ? translate("Select {count} more to save", { count: remaining })
                    : translate("Ctrl/⌘ + Enter to save")}
                </p>
                <div className="flex items-center gap-2">
                  {(editing || selected.length > 0) && (
                    <Button variant="outline" size="sm" onClick={resetBuilder} disabled={saving}>
                      {translate("Cancel")}
                    </Button>
                  )}
                  <Button size="sm" onClick={handleSave} disabled={!canSave}>
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : editing ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {saving ? translate("Saving...") : editing ? translate("Update") : translate("Save Combination")}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Saved combinations */}
          <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <h3 className="text-sm font-semibold">{translate("Saved combinations")}</h3>
              <span className="font-data rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {combinations.length}
              </span>
            </div>

            {combinations.length === 0 ? (
              <EmptyBlock
                icon={Link2}
                title={translate("No combinations yet")}
                description={translate("Select 2 or more clients and save them as a combination.")}
              />
            ) : (
              <ul className="max-h-[36rem] space-y-2 overflow-y-auto p-3">
                {combinations.map((combo) => {
                  const isEditing = combo.id === editingId;
                  const extra = combo.members.length - MEMBER_PREVIEW;
                  return (
                    <li
                      key={combo.id}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        isEditing ? "border-primary/50 bg-accent" : "border-border/60 bg-background hover:border-border"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-data text-[11px] text-muted-foreground tabular-nums">
                            {translate(combo.members.length === 1 ? "{count} client" : "{count} clients", {
                              count: combo.members.length,
                            })}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold leading-snug break-words">
                            {comboLabel(combo)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => startEdit(combo)}
                            aria-label={translate("Edit")}
                            title={translate("Edit")}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setPendingDelete(combo)}
                            aria-label={translate("Delete")}
                            title={translate("Delete")}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {combo.members.slice(0, MEMBER_PREVIEW).map((m) => (
                          <span
                            key={m.client_key}
                            className="max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {m.client_name}
                          </span>
                        ))}
                        {extra > 0 && (
                          <span className="font-data rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            +{extra}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight">{translate("Client Combinations")}</h1>
          <p className="truncate text-xs text-muted-foreground">{translate("Group clients for EPro reports")}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="flex max-h-[40vh] shrink-0 flex-col border-b border-border/60 bg-card lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r xl:w-80">
          <AgentList
            agents={agents}
            selectedAgent={selectedAgent}
            onSelectAgent={handleSelectAgent}
            searchQuery={agentSearch}
            onSearchChange={setAgentSearch}
            isLoading={agentsLoading}
          />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{renderMain()}</main>
      </div>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-destructive" />
              {translate("Delete combination")}
            </DialogTitle>
            <DialogDescription>
              {pendingDelete &&
                translate("Delete “{name}”? Its clients will be reported separately again.", {
                  name: comboLabel(pendingDelete),
                })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              {translate("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {translate("Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

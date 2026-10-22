"use client";

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Users, Plus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AgentInfo {
  name: string;
  client_count: number;
}

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

export default function ClientsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [clients, setClients] = useState<string[]>([]);
  const [availableClients, setAvailableClients] = useState<string[]>([]);
  const [combinations, setCombinations] = useState<ClientCombination[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const result = await invoke<AgentInfo[]>("list_combination_agents");
        setAgents(result);
      } catch (err) {
        console.error(err);
        setAgents([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedAgent) {
      setAvailableClients([]);
      setCombinations([]);
      setClients([]);
      setEditingId(null);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const [clientsResult, combosResult] = await Promise.all([
          invoke<string[]>("list_clients_for_agent", { agentName: selectedAgent }),
          invoke<ClientCombination[]>("list_client_combinations", { agentName: selectedAgent }),
        ]);
        setAvailableClients(clientsResult.filter((c) => c && c.trim()));
        setCombinations(combosResult);
        setError(null);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load data");
        setAvailableClients([]);
        setCombinations([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedAgent]);

  const filteredClients = availableClients.filter((c) =>
    c.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleClient = (client: string) => {
    setClients((prev) =>
      prev.includes(client) ? prev.filter((c) => c !== client) : [...prev, client]
    );
  };

  const startEdit = (combo: ClientCombination) => {
    setEditingId(combo.id);
    setClients(combo.members.map((m) => m.client_name));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setClients([]);
    setError(null);
  };

  const handleSave = async () => {
    if (clients.length < 2) {
      setError("At least 2 clients are required");
      return;
    }
    if (!selectedAgent) return;

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await invoke("update_client_combination", { combinationId: editingId, clientNames: clients });
      } else {
        await invoke("create_client_combination", { agentName: selectedAgent, clientNames: clients });
      }
      const combosResult = await invoke<ClientCombination[]>("list_client_combinations", { agentName: selectedAgent });
      setCombinations(combosResult);
      setEditingId(null);
      setClients([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save combination");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke("delete_client_combination", { combinationId: id });
      const combosResult = await invoke<ClientCombination[]>("list_client_combinations", { agentName: selectedAgent ?? "" });
      setCombinations(combosResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const displayName = (combo: ClientCombination) =>
    combo.members.map((m) => m.client_name).join(" + ");

  return (
    <div className="flex h-full bg-background/50">
      <aside className="w-80 shrink-0 border-r border-border/50 bg-card flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-border/50">
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Client Combinations
          </h1>
          <p className="text-[10px] text-muted-foreground mb-3">
            Group clients for EPro reports
          </p>

          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Agent
            </label>
            <Select value={selectedAgent ?? ""} onValueChange={(v) => setSelectedAgent(v || null)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.name} value={a.name} className="text-xs">
                    {a.name} ({a.client_count} clients)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-xs">Loading...</span>
            </div>
          )}

          {!loading && !selectedAgent && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Select an agent to combine clients.
            </p>
          )}

          {!loading && selectedAgent && (
            <>
              <div className="mb-4">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  {editingId ? "Edit clients" : "Select clients (min 2)"}
                </label>
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-xs mb-2"
                />
                <div className="border border-border/50 rounded-md max-h-40 overflow-auto">
                  {filteredClients.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">No clients found</p>
                  )}
                  {filteredClients.map((c) => {
                    const selected = clients.includes(c);
                    const inAnotherCombo = combinations.some(
                      (combo) =>
                        combo.id !== editingId &&
                        combo.members.some((m) => m.client_name === c)
                    );
                    return (
                      <button
                        key={c}
                        disabled={inAnotherCombo && !selected}
                        onClick={() => toggleClient(c)}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-muted/50 transition-colors ${
                          selected
                            ? "bg-primary/10 text-primary"
                            : inAnotherCombo
                            ? "text-muted-foreground/50 cursor-not-allowed line-through"
                            : ""
                        }`}
                      >
                        <span>{c}</span>
                        {selected && <span className="text-[10px]">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {clients.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {clients.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px]"
                      >
                        {c}
                        <button onClick={() => toggleClient(c)}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {clients.length >= 2 && !editingId && (
                  <Button size="sm" className="mt-3 w-full h-7 text-xs gap-1" onClick={handleSave} disabled={saving}>
                    <Plus size={12} />
                    Save Combination
                  </Button>
                )}

                {editingId && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSave} disabled={saving}>
                      {saving ? "Saving..." : "Update"}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {combinations.length > 0 && (
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Saved combinations
                  </label>
                  <div className="space-y-2">
                    {combinations.map((combo) => (
                      <div
                        key={combo.id}
                        className="p-3 rounded-md border border-border/50 bg-card/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{displayName(combo)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {combo.members.length} clients
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => startEdit(combo)}
                              className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(combo.id)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {combinations.length === 0 && !editingId && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No combinations saved yet. Select 2+ clients above.
                </p>
              )}
            </>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 bg-card/30">
          <h2 className="text-sm font-semibold">
            {selectedAgent ? selectedAgent : "Client Combinations"}
          </h2>
          <p className="text-[10px] text-muted-foreground">
            {selectedAgent && combinations.length > 0
              ? `${combinations.length} combination${combinations.length !== 1 ? "s" : ""} saved`
              : "Build combined client groups for EPro reporting"}
          </p>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-xs mb-4">
              {error}
            </div>
          )}

          {!selectedAgent && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Users className="w-12 h-12 opacity-20" />
              <p className="text-sm font-medium">No agent selected</p>
              <p className="text-xs max-w-sm text-center">
                Select an agent from the left panel to build client combinations
                for EPro reporting.
              </p>
            </div>
          )}

          {selectedAgent && combinations.length > 0 && !editingId && (
            <div className="space-y-3">
              {combinations.map((combo) => (
                <div key={combo.id} className="p-4 rounded-lg border border-border/50 bg-card/50">
                  <h3 className="text-sm font-semibold">{displayName(combo)}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {combo.members.length} client members
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {combo.members.map((m) => (
                      <span key={m.client_key} className="inline-flex px-2 py-0.5 rounded-md bg-primary/5 text-xs">
                        {m.client_name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedAgent && combinations.length === 0 && !editingId && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Plus className="w-10 h-10 opacity-20" />
              <p className="text-sm font-medium">No combinations yet</p>
              <p className="text-xs max-w-sm text-center">
                Select 2 or more clients from the left panel and save them as a combination.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

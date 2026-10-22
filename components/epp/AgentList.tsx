"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Search, Users, X, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AgentInfo {
  name: string;
  client_count: number;
}

interface AgentListProps {
  agents: AgentInfo[];
  selectedAgent: string | null;
  onSelectAgent: (agent: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading?: boolean;
}

export function AgentList({
  agents,
  selectedAgent,
  onSelectAgent,
  searchQuery,
  onSearchChange,
  isLoading = false,
}: AgentListProps) {
  useLanguage();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  // Keyboard: arrows move through the list, "/" focuses search, Escape clears it.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (filteredAgents.length === 0) return;
      e.preventDefault();
      const current = filteredAgents.findIndex((a) => a.name === selectedAgent);
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next = current === -1
        ? (step === 1 ? 0 : filteredAgents.length - 1)
        : (current + step + filteredAgents.length) % filteredAgents.length;
      onSelectAgent(filteredAgents[next].name);
      listRef.current?.querySelector<HTMLButtonElement>(`[data-agent-index="${next}"]`)?.focus();
    } else if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      searchRef.current?.focus();
    } else if (e.key === "Escape" && searchQuery) {
      onSearchChange("");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="space-y-2.5 border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {translate("Agents")}
          </h2>
          <span className="font-data text-[11px] text-muted-foreground tabular-nums">
            {filteredAgents.length}/{agents.length}
          </span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={searchRef}
            type="text"
            aria-label={translate("Search agents")}
            placeholder={translate("Search agents...")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onSearchChange("");
                e.currentTarget.blur();
              }
            }}
            className="h-9 pl-9 pr-9 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label={translate("Clear search")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Agent list */}
      <div
        ref={listRef}
        role="listbox"
        aria-label={translate("Agents")}
        aria-busy={isLoading}
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        {isLoading ? (
          <div className="space-y-1.5 p-1" aria-label={translate("Loading agents...")}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex animate-pulse items-center justify-between rounded-lg px-3 py-2.5">
                <div className="h-3.5 w-36 rounded bg-muted" />
                <div className="h-4 w-6 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{translate("No agents found")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{translate("Import data first to see agents here.")}</p>
            </div>
            <Link href="/upload" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
              <Upload className="h-3.5 w-3.5" />
              {translate("Go to Raw data")}
            </Link>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {translate("No agents match “{query}”", { query: searchQuery })}
            </p>
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {translate("Clear search")}
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredAgents.map((agent, index) => {
              const selected = selectedAgent === agent.name;
              return (
                <button
                  key={agent.name}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-current={selected ? "true" : undefined}
                  data-agent-index={index}
                  onClick={() => onSelectAgent(agent.name)}
                  className={cn(
                    "relative flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                  )}
                >
                  {selected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />}
                  <span className={cn("truncate text-sm", selected && "font-semibold")}>{agent.name}</span>
                  <span
                    className={cn(
                      "font-data shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums",
                      selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {agent.client_count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {agents.length > 0 && (
        <div className="border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
          {translate(filteredAgents.length === 1 ? "{count} agent" : "{count} agents", { count: filteredAgents.length })}
          {searchQuery.trim() && ` · ${translate("of {total} total", { total: agents.length })}`}
        </div>
      )}
    </div>
  );
}

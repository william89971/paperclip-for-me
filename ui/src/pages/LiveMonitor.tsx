import { useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import type { Agent, Issue } from "@paperclipai/shared";
import { heartbeatsApi, type LiveRunForIssue } from "../api/heartbeats";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { messagesApi } from "../api/messages";
import type { TranscriptEntry } from "../adapters";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, relativeTime } from "../lib/utils";
import { RunTranscriptView } from "../components/transcript/RunTranscriptView";
import { useLiveRunTranscripts } from "../components/transcript/useLiveRunTranscripts";
import { AgentAvatar } from "../components/AgentAvatar";
import { EmptyState } from "../components/EmptyState";
import { ExternalLink, Radio, MessageSquare } from "lucide-react";
import { useEffect } from "react";

function isRunActive(run: LiveRunForIssue): boolean {
  return run.status === "queued" || run.status === "running";
}

export function LiveMonitor() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Live Monitor" }]);
  }, [setBreadcrumbs]);

  const { data: liveRuns } = useQuery({
    queryKey: [...queryKeys.liveRuns(selectedCompanyId!), "monitor"],
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!, 20),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedCompanyId],
    queryFn: () => messagesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const runs = liveRuns ?? [];

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const issueById = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const i of issues ?? []) map.set(i.id, i);
    return map;
  }, [issues]);

  const { transcriptByRun, hasOutputForRun } = useLiveRunTranscripts({
    runs,
    companyId: selectedCompanyId!,
    maxChunksPerRun: 200,
  });

  // Group runs by agent
  const runsByAgent = useMemo(() => {
    const map = new Map<string, LiveRunForIssue[]>();
    for (const run of runs) {
      const list = map.get(run.agentId) ?? [];
      list.push(run);
      map.set(run.agentId, list);
    }
    return map;
  }, [runs]);

  // Recent messages (last 20)
  const recentMessages = useMemo(() => {
    return (messages ?? []).slice(0, 20);
  }, [messages]);

  const activeAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of runs) {
      if (isRunActive(run)) ids.add(run.agentId);
    }
    return ids;
  }, [runs]);

  // All agents with runs or active status
  const monitoredAgents = useMemo(() => {
    const agentIds = new Set([...runsByAgent.keys()]);
    // Also include agents that are active but may not have runs in this batch
    for (const a of agents ?? []) {
      if (a.status === "active" || a.status === "running") agentIds.add(a.id);
    }
    return [...agentIds].map((id) => agentById.get(id)).filter(Boolean) as Agent[];
  }, [runsByAgent, agents, agentById]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Radio} message="Select a company to view live agent activity." />;
  }

  if (monitoredAgents.length === 0) {
    return (
      <EmptyState
        icon={Radio}
        message="No agents are active right now. Assign a task and agents will start working."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Live Monitor</h1>
          <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-medium text-cyan-700 dark:text-cyan-300">
            {activeAgentIds.size} active
          </span>
        </div>
      </div>

      {/* Agent columns */}
      <div className={cn(
        "grid gap-4",
        monitoredAgents.length === 1 && "grid-cols-1",
        monitoredAgents.length === 2 && "grid-cols-1 lg:grid-cols-2",
        monitoredAgents.length >= 3 && "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
      )}>
        {monitoredAgents.map((agent) => {
          const agentRuns = runsByAgent.get(agent.id) ?? [];
          const latestRun = agentRuns[0];
          const active = activeAgentIds.has(agent.id);
          const issue = latestRun?.issueId ? issueById.get(latestRun.issueId) : undefined;
          const transcript = latestRun ? (transcriptByRun.get(latestRun.id) ?? []) : [];
          const hasOutput = latestRun ? hasOutputForRun(latestRun.id) : false;

          return (
            <div
              key={agent.id}
              className={cn(
                "flex flex-col rounded-xl border overflow-hidden transition-shadow",
                active
                  ? "border-cyan-500/30 shadow-[0_4px_24px_rgba(6,182,212,0.1)]"
                  : "border-border shadow-sm",
              )}
            >
              {/* Agent header */}
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <div className="relative">
                  <AgentAvatar name={agent.name} agentId={agent.id} size="md" />
                  {active && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-500 border-2 border-card" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/agents/${agent.id}`}
                      className="text-sm font-semibold hover:underline truncate"
                    >
                      {agent.name}
                    </Link>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      active
                        ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                        : "bg-muted text-muted-foreground",
                    )}>
                      {active ? "Working" : agent.status}
                    </span>
                  </div>
                  {issue && (
                    <Link
                      to={`/issues/${issue.identifier ?? latestRun!.issueId}`}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline truncate block mt-0.5"
                    >
                      {issue.identifier} — {issue.title}
                    </Link>
                  )}
                </div>
                {latestRun && (
                  <Link
                    to={`/agents/${agent.id}/runs/${latestRun.id}`}
                    className="shrink-0 rounded-full border border-border/70 bg-background/70 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title="View full run"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {/* Live transcript */}
              <div className="flex-1 min-h-[200px] max-h-[400px] overflow-y-auto p-3 bg-muted/20">
                {latestRun ? (
                  <RunTranscriptView
                    entries={transcript}
                    density="compact"
                    limit={10}
                    streaming={active}
                    collapseStdout
                    thinkingClassName="!text-[10px] !leading-4"
                    emptyMessage={
                      hasOutput
                        ? "Waiting for transcript parsing..."
                        : active
                          ? "Waiting for output..."
                          : "No transcript captured."
                    }
                  />
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Idle — no recent runs
                  </p>
                )}
              </div>

              {/* Run time */}
              <div className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
                {latestRun
                  ? active
                    ? `Running since ${relativeTime(latestRun.createdAt)}`
                    : latestRun.finishedAt
                      ? `Finished ${relativeTime(latestRun.finishedAt)}`
                      : `Started ${relativeTime(latestRun.createdAt)}`
                  : "No recent activity"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent messages between agents */}
      {recentMessages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Agent Messages
            </h2>
          </div>
          <div className="rounded-xl border border-border divide-y divide-border/60">
            {recentMessages.map((msg) => {
              const from = agentById.get(msg.fromAgentId);
              const to = agentById.get(msg.toAgentId);
              return (
                <div key={msg.id} className="flex items-start gap-3 px-4 py-3">
                  <AgentAvatar
                    name={from?.name ?? "Unknown"}
                    agentId={msg.fromAgentId}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium">{from?.name ?? "Unknown"}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{to?.name ?? "Unknown"}</span>
                      <span className="ml-auto text-muted-foreground shrink-0">
                        {relativeTime(msg.createdAt)}
                      </span>
                    </div>
                    {msg.subject && (
                      <p className="text-xs font-medium mt-0.5">{msg.subject}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {msg.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

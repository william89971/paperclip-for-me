import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { Link } from "@/lib/router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agent, Issue } from "@paperclipai/shared";
import { heartbeatsApi, type LiveRunForIssue } from "../api/heartbeats";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { messagesApi } from "../api/messages";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, relativeTime } from "../lib/utils";
import { RunTranscriptView } from "../components/transcript/RunTranscriptView";
import { useLiveRunTranscripts } from "../components/transcript/useLiveRunTranscripts";
import { AgentAvatar } from "../components/AgentAvatar";
import { EmptyState } from "../components/EmptyState";
import { Radio, Send, Loader2, Terminal, ChevronRight } from "lucide-react";

function isRunActive(run: LiveRunForIssue): boolean {
  return run.status === "queued" || run.status === "running";
}

export function LiveMonitor() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  const visibleAgents = useMemo(() => {
    return (agents ?? []).filter((a) => a.status !== "terminated");
  }, [agents]);

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
    maxChunksPerRun: 300,
  });

  const runsByAgent = useMemo(() => {
    const map = new Map<string, LiveRunForIssue[]>();
    for (const run of runs) {
      const list = map.get(run.agentId) ?? [];
      list.push(run);
      map.set(run.agentId, list);
    }
    return map;
  }, [runs]);

  const activeAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of runs) {
      if (isRunActive(run)) ids.add(run.agentId);
    }
    return ids;
  }, [runs]);

  // Auto-select first agent
  useEffect(() => {
    if (!selectedAgentId && visibleAgents.length > 0) {
      setSelectedAgentId(visibleAgents[0]!.id);
    }
  }, [selectedAgentId, visibleAgents]);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptByRun, selectedAgentId]);

  const selectedAgent = selectedAgentId ? agentById.get(selectedAgentId) : null;
  const selectedRuns = selectedAgentId ? (runsByAgent.get(selectedAgentId) ?? []) : [];
  const latestRun = selectedRuns[0];
  const active = selectedAgentId ? activeAgentIds.has(selectedAgentId) : false;
  const issue = latestRun?.issueId ? issueById.get(latestRun.issueId) : undefined;
  const transcript = latestRun ? (transcriptByRun.get(latestRun.id) ?? []) : [];
  const hasOutput = latestRun ? hasOutputForRun(latestRun.id) : false;

  // Agent messages for selected agent
  const agentMessages = useMemo(() => {
    if (!selectedAgentId) return [];
    return (messages ?? []).filter(
      (m) => m.fromAgentId === selectedAgentId || m.toAgentId === selectedAgentId
    );
  }, [messages, selectedAgentId]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending || !selectedAgent) return;
    setSending(true);
    try {
      if (latestRun?.issueId) {
        await issuesApi.addComment(latestRun.issueId, body, false, true);
      } else {
        await issuesApi.create(selectedCompanyId!, {
          title: body.length > 80 ? body.slice(0, 77) + "..." : body,
          description: body,
          assigneeId: selectedAgent.id,
          status: "todo",
        });
      }
      setText("");
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.liveRuns(selectedCompanyId!) });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [text, sending, selectedAgent, latestRun, selectedCompanyId, queryClient]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Radio} message="Select a company to view live agent activity." />;
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] rounded-xl border border-border overflow-hidden shadow-md">
      {/* ── Left sidebar: agent channels ── */}
      <div className="w-60 shrink-0 border-r border-border bg-[#1a1a2e] dark:bg-[#0f0f1a] flex flex-col">
        {/* Workspace header */}
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-bold text-white">Live Monitor</h2>
          <p className="text-[10px] text-white/40 mt-0.5">
            {activeAgentIds.size} agent{activeAgentIds.size !== 1 ? "s" : ""} working
          </p>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Agents
            </span>
          </div>
          {visibleAgents.map((agent) => {
            const isActive = activeAgentIds.has(agent.id);
            const isSelected = selectedAgentId === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => { setSelectedAgentId(agent.id); inputRef.current?.focus(); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                  isSelected
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white/80",
                )}
              >
                <AgentAvatar name={agent.name} agentId={agent.id} size="xs" />
                <span className="flex-1 text-[13px] font-medium truncate">{agent.name}</span>
                {isActive && (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                )}
              </button>
            );
          })}

          {/* Messages section */}
          {agentMessages.length > 0 && (
            <>
              <div className="px-3 mt-4 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  Messages
                </span>
              </div>
              {agentMessages.slice(0, 8).map((msg) => {
                const from = agentById.get(msg.fromAgentId);
                const to = agentById.get(msg.toAgentId);
                return (
                  <div key={msg.id} className="px-3 py-1.5">
                    <div className="text-[10px] text-white/40">
                      <span className="text-white/60 font-medium">{from?.name ?? "?"}</span>
                      {" → "}
                      <span className="text-white/60 font-medium">{to?.name ?? "?"}</span>
                    </div>
                    <p className="text-[11px] text-white/50 truncate">{msg.body}</p>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Main terminal area ── */}
      <div className="flex-1 flex flex-col bg-[#0d1117] dark:bg-[#0a0a0f]">
        {selectedAgent ? (
          <>
            {/* Channel header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#161b22] dark:bg-[#111118]">
              <AgentAvatar name={selectedAgent.name} agentId={selectedAgent.id} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{selectedAgent.name}</span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    active
                      ? "bg-green-500/20 text-green-400"
                      : "bg-white/10 text-white/40",
                  )}>
                    {active ? "Working" : selectedAgent.status}
                  </span>
                </div>
                {issue && (
                  <Link
                    to={`/issues/${issue.identifier ?? latestRun!.issueId}`}
                    className="text-xs text-white/40 hover:text-white/60 hover:underline truncate block"
                  >
                    {issue.identifier} — {issue.title}
                  </Link>
                )}
              </div>
              {latestRun && (
                <div className="text-[10px] text-white/30 shrink-0">
                  {active
                    ? `Running since ${relativeTime(latestRun.createdAt)}`
                    : latestRun.finishedAt
                      ? `Finished ${relativeTime(latestRun.finishedAt)}`
                      : `Started ${relativeTime(latestRun.createdAt)}`}
                </div>
              )}
            </div>

            {/* Terminal output */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
              {latestRun ? (
                <div className="[&_*]:!font-mono [&_.prose]:!text-green-400 [&_.prose_p]:!text-green-400 [&_.prose_li]:!text-green-400 [&_.prose_code]:!text-cyan-400 [&_.prose_strong]:!text-white [&_.prose_h1]:!text-white [&_.prose_h2]:!text-white [&_.prose_h3]:!text-white [&_.prose_a]:!text-cyan-400">
                  <RunTranscriptView
                    entries={transcript}
                    density="comfortable"
                    limit={50}
                    streaming={active}
                    collapseStdout={false}
                    className="[&>div]:!border-white/5"
                    emptyMessage={
                      hasOutput
                        ? "Parsing output..."
                        : active
                          ? "$ waiting for output..."
                          : "No output captured."
                    }
                  />
                </div>
              ) : (
                <div className="text-green-500/60 py-8">
                  <p>$ agent idle — no active runs</p>
                  <p className="mt-1">$ type a message below to give {selectedAgent.name} a task</p>
                  <span className="inline-block w-2 h-4 bg-green-500/60 animate-pulse mt-1" />
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>

            {/* Chat input bar */}
            <div className="border-t border-white/10 bg-[#161b22] dark:bg-[#111118] px-4 py-3">
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0d1117] dark:bg-[#0a0a0f] px-3 py-2">
                <ChevronRight className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <input
                  ref={inputRef}
                  className="flex-1 bg-transparent text-sm text-white font-mono outline-none placeholder:text-white/25"
                  placeholder={latestRun?.issueId ? `Message ${selectedAgent.name}...` : `New task for ${selectedAgent.name}...`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  disabled={sending}
                />
                <button
                  onClick={() => void send()}
                  disabled={!text.trim() || sending}
                  className="shrink-0 rounded p-1 text-white/30 hover:text-green-400 transition-colors disabled:opacity-20"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-white/20 mt-1.5 px-1">
                {latestRun?.issueId ? "Posts a comment on the current task — agent wakes up to read it" : "Creates a new task and assigns it to this agent"}
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/30">
              <Terminal className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select an agent to view their terminal</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

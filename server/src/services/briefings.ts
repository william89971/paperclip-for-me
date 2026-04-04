import { and, eq, gte, desc, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companyBriefings, agents, issues, costEvents, heartbeatRuns, activityLog, companies } from "@paperclipai/db";

function buildBriefingText(data: {
  generatedAt: string;
  agentsByStatus: Record<string, number>;
  issuesByStatus: Record<string, number>;
  recentActivityCount: number;
  monthSpendCents: number;
  budgetMonthlyCents: number;
  failedRunCount: number;
}) {
  const {
    generatedAt,
    agentsByStatus,
    issuesByStatus,
    recentActivityCount,
    monthSpendCents,
    budgetMonthlyCents,
    failedRunCount,
  } = data;

  const active = agentsByStatus["active"] ?? agentsByStatus["idle"] ?? 0;
  const paused = agentsByStatus["paused"] ?? 0;
  const errors = agentsByStatus["error"] ?? 0;

  const inProgress = issuesByStatus["in_progress"] ?? 0;
  const blocked = issuesByStatus["blocked"] ?? 0;
  const todo = issuesByStatus["todo"] ?? 0;
  const backlog = issuesByStatus["backlog"] ?? 0;
  const completed = issuesByStatus["done"] ?? 0;
  const totalOpen = inProgress + blocked + todo + backlog;

  const dollars = (monthSpendCents / 100).toFixed(2);
  const budget = (budgetMonthlyCents / 100).toFixed(2);
  const percent =
    budgetMonthlyCents > 0
      ? ((monthSpendCents / budgetMonthlyCents) * 100).toFixed(1)
      : "0.0";

  return [
    `## Company Status Briefing`,
    `**Generated:** ${generatedAt}`,
    ``,
    `### Team Status`,
    `- ${active} agents active, ${paused} paused, ${errors} errors`,
    ``,
    `### Open Tasks`,
    `- ${totalOpen} total open (${inProgress} in_progress, ${blocked} blocked, ${todo} todo, ${backlog} backlog)`,
    `- ${completed} completed all-time`,
    ``,
    `### Recent Activity (24h)`,
    `- ${recentActivityCount} events logged`,
    ``,
    `### Cost (Current Month)`,
    `- $${dollars} spent of $${budget} budget (${percent}% utilized)`,
    ``,
    `### Recent Failures (24h)`,
    `- ${failedRunCount} failed runs`,
  ].join("\n");
}

export function briefingService(db: Db) {
  return {
    getLatest: async (companyId: string) => {
      const rows = await db
        .select()
        .from(companyBriefings)
        .where(eq(companyBriefings.companyId, companyId))
        .orderBy(desc(companyBriefings.generatedAt))
        .limit(1);

      return rows[0] ?? null;
    },

    generate: async (companyId: string) => {
      // 1. Agents grouped by status
      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const agentsByStatus: Record<string, number> = {};
      for (const row of agentRows) {
        const bucket = row.status === "idle" ? "active" : row.status;
        agentsByStatus[bucket] = (agentsByStatus[bucket] ?? 0) + Number(row.count);
      }

      // 2. Issues grouped by status
      const issueRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const issuesByStatus: Record<string, number> = {};
      for (const row of issueRows) {
        issuesByStatus[row.status] = Number(row.count);
      }

      // 3. Activity count in last 24h
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [{ activityCount }] = await db
        .select({ activityCount: sql<number>`count(*)` })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.companyId, companyId),
            gte(activityLog.createdAt, twentyFourHoursAgo),
          ),
        );

      // 4. Cost spend for current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );

      // 5. Company budget
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      const budgetMonthlyCents = company?.budgetMonthlyCents ?? 0;

      // 6. Failed heartbeat runs in last 24h
      const [{ failedCount }] = await db
        .select({ failedCount: sql<number>`count(*)` })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            eq(heartbeatRuns.status, "failed"),
            gte(heartbeatRuns.createdAt, twentyFourHoursAgo),
          ),
        );

      const generatedAt = new Date().toISOString();
      const content = buildBriefingText({
        generatedAt,
        agentsByStatus,
        issuesByStatus,
        recentActivityCount: Number(activityCount),
        monthSpendCents: Number(monthSpend),
        budgetMonthlyCents,
        failedRunCount: Number(failedCount),
      });

      const [row] = await db
        .insert(companyBriefings)
        .values({
          companyId,
          content,
          generatedAt: new Date(generatedAt),
          metadata: {
            agentsByStatus,
            issuesByStatus,
            recentActivityCount: Number(activityCount),
            monthSpendCents: Number(monthSpend),
            budgetMonthlyCents,
            failedRunCount: Number(failedCount),
          },
        })
        .returning();

      return row;
    },
  };
}

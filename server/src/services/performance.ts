import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { heartbeatRuns, issues, costEvents } from "@paperclipai/db";

export function performanceService(db: Db) {
  return {
    getAgentPerformance: async (agentId: string, rangeDays: number) => {
      const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

      // 1. Heartbeat run metrics
      const runRows = await db
        .select({
          total: sql<number>`count(*)::int`,
          succeeded: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'succeeded')::int`,
          avgDurationMs: sql<number>`avg(extract(epoch from (${heartbeatRuns.finishedAt} - ${heartbeatRuns.startedAt})) * 1000) filter (where ${heartbeatRuns.finishedAt} is not null)`,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.agentId, agentId),
            gte(heartbeatRuns.createdAt, since),
          ),
        );

      const totalRuns = Number(runRows[0]?.total ?? 0);
      const succeeded = Number(runRows[0]?.succeeded ?? 0);
      const successRate = totalRuns > 0 ? succeeded / totalRuns : 0;
      const avgDurationMs = runRows[0]?.avgDurationMs != null
        ? Math.round(Number(runRows[0].avgDurationMs))
        : null;

      // 2. Issue completion metrics
      const issueRows = await db
        .select({
          completed: sql<number>`count(*)::int`,
          avgCycleHours: sql<number>`avg(extract(epoch from (${issues.updatedAt} - ${issues.createdAt})) / 3600)`,
        })
        .from(issues)
        .where(
          and(
            eq(issues.assigneeAgentId, agentId),
            eq(issues.status, "done"),
            gte(issues.updatedAt, since),
          ),
        );

      const tasksCompleted = Number(issueRows[0]?.completed ?? 0);
      const avgCycleTimeHours = issueRows[0]?.avgCycleHours != null
        ? Math.round(Number(issueRows[0].avgCycleHours) * 10) / 10
        : null;

      // 3. Cost metrics
      const costRows = await db
        .select({
          totalCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.agentId, agentId),
            gte(costEvents.occurredAt, since),
          ),
        );

      const totalCostCents = Number(costRows[0]?.totalCents ?? 0);
      const costPerTask = tasksCompleted > 0
        ? Math.round(totalCostCents / tasksCompleted)
        : null;

      return {
        agentId,
        range: `${rangeDays}d`,
        successRate: Math.round(successRate * 1000) / 1000,
        totalRuns,
        avgDurationMs,
        tasksCompleted,
        avgCycleTimeHours,
        totalCostCents,
        costPerTask,
      };
    },
  };
}

import { eq, count } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companies,
  agents,
  agentApiKeys,
  agentConfigRevisions,
  agentRuntimeState,
  agentTaskSessions,
  agentWakeupRequests,
  agentMessages,
  agentSchedules,
  issues,
  issueApprovals,
  issueAttachments,
  issueComments,
  issueLabels,
  issueReadStates,
  projects,
  projectGoals,
  projectWorkspaces,
  goals,
  heartbeatRuns,
  heartbeatRunEvents,
  costEvents,
  approvalComments,
  approvals,
  activityLog,
  assets,
  companySecrets,
  companyBriefings,
  joinRequests,
  invites,
  labels,
  principalPermissionGrants,
  companyMemberships,
  knowledgeEntries,
  notificationRules,
  notificationChannels,
  webhookEvents,
  webhookEndpoints,
  workspaceRuntimeServices,
} from "@paperclipai/db";

export function companyService(db: Db) {
  const ISSUE_PREFIX_FALLBACK = "CMP";

  function deriveIssuePrefixBase(name: string) {
    const normalized = name.toUpperCase().replace(/[^A-Z]/g, "");
    return normalized.slice(0, 3) || ISSUE_PREFIX_FALLBACK;
  }

  function suffixForAttempt(attempt: number) {
    if (attempt <= 1) return "";
    return "A".repeat(attempt - 1);
  }

  function isIssuePrefixConflict(error: unknown) {
    const constraint = typeof error === "object" && error !== null && "constraint" in error
      ? (error as { constraint?: string }).constraint
      : typeof error === "object" && error !== null && "constraint_name" in error
        ? (error as { constraint_name?: string }).constraint_name
        : undefined;
    return typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: string }).code === "23505"
      && constraint === "companies_issue_prefix_idx";
  }

  async function createCompanyWithUniquePrefix(data: typeof companies.$inferInsert) {
    const base = deriveIssuePrefixBase(data.name);
    let suffix = 1;
    while (suffix < 10000) {
      const candidate = `${base}${suffixForAttempt(suffix)}`;
      try {
        const rows = await db
          .insert(companies)
          .values({ ...data, issuePrefix: candidate })
          .returning();
        return rows[0];
      } catch (error) {
        if (!isIssuePrefixConflict(error)) throw error;
      }
      suffix += 1;
    }
    throw new Error("Unable to allocate unique issue prefix");
  }

  return {
    list: () => db.select().from(companies),

    getById: (id: string) =>
      db
        .select()
        .from(companies)
        .where(eq(companies.id, id))
        .then((rows) => rows[0] ?? null),

    create: async (data: typeof companies.$inferInsert) => createCompanyWithUniquePrefix(data),

    update: (id: string, data: Partial<typeof companies.$inferInsert>) =>
      db
        .update(companies)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(companies.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    archive: (id: string) =>
      db
        .update(companies)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(companies.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db.transaction(async (tx) => {
        // Delete all company data — deepest FK dependencies first
        // Leaf tables (no other table references these)
        await tx.delete(webhookEvents).where(eq(webhookEvents.companyId, id));
        await tx.delete(notificationRules).where(eq(notificationRules.companyId, id));
        await tx.delete(costEvents).where(eq(costEvents.companyId, id));
        await tx.delete(activityLog).where(eq(activityLog.companyId, id));
        await tx.delete(heartbeatRunEvents).where(eq(heartbeatRunEvents.companyId, id));
        await tx.delete(agentTaskSessions).where(eq(agentTaskSessions.companyId, id));
        await tx.delete(agentConfigRevisions).where(eq(agentConfigRevisions.companyId, id));
        await tx.delete(issueLabels).where(eq(issueLabels.companyId, id));
        await tx.delete(issueReadStates).where(eq(issueReadStates.companyId, id));
        await tx.delete(issueApprovals).where(eq(issueApprovals.companyId, id));
        await tx.delete(issueAttachments).where(eq(issueAttachments.companyId, id));
        await tx.delete(issueComments).where(eq(issueComments.companyId, id));
        await tx.delete(approvalComments).where(eq(approvalComments.companyId, id));
        // companySecretVersions cascades via companySecrets FK
        await tx.delete(workspaceRuntimeServices).where(eq(workspaceRuntimeServices.companyId, id));
        await tx.delete(projectGoals).where(eq(projectGoals.companyId, id));
        await tx.delete(assets).where(eq(assets.companyId, id));
        // Mid-level tables
        await tx.delete(webhookEndpoints).where(eq(webhookEndpoints.companyId, id));
        await tx.delete(notificationChannels).where(eq(notificationChannels.companyId, id));
        await tx.delete(knowledgeEntries).where(eq(knowledgeEntries.companyId, id));
        await tx.delete(companyBriefings).where(eq(companyBriefings.companyId, id));
        await tx.delete(agentMessages).where(eq(agentMessages.companyId, id));
        await tx.delete(agentSchedules).where(eq(agentSchedules.companyId, id));
        await tx.delete(heartbeatRuns).where(eq(heartbeatRuns.companyId, id));
        await tx.delete(agentWakeupRequests).where(eq(agentWakeupRequests.companyId, id));
        await tx.delete(agentApiKeys).where(eq(agentApiKeys.companyId, id));
        await tx.delete(agentRuntimeState).where(eq(agentRuntimeState.companyId, id));
        await tx.delete(approvals).where(eq(approvals.companyId, id));
        await tx.delete(companySecrets).where(eq(companySecrets.companyId, id));
        await tx.delete(joinRequests).where(eq(joinRequests.companyId, id));
        await tx.delete(invites).where(eq(invites.companyId, id));
        await tx.delete(principalPermissionGrants).where(eq(principalPermissionGrants.companyId, id));
        await tx.delete(companyMemberships).where(eq(companyMemberships.companyId, id));
        await tx.delete(labels).where(eq(labels.companyId, id));
        // Core tables (referenced by many others — delete last)
        await tx.delete(projectWorkspaces).where(eq(projectWorkspaces.companyId, id));
        await tx.delete(issues).where(eq(issues.companyId, id));
        await tx.delete(goals).where(eq(goals.companyId, id));
        await tx.delete(projects).where(eq(projects.companyId, id));
        await tx.delete(agents).where(eq(agents.companyId, id));
        const rows = await tx
          .delete(companies)
          .where(eq(companies.id, id))
          .returning();
        return rows[0] ?? null;
      }),

    stats: () =>
      Promise.all([
        db
          .select({ companyId: agents.companyId, count: count() })
          .from(agents)
          .groupBy(agents.companyId),
        db
          .select({ companyId: issues.companyId, count: count() })
          .from(issues)
          .groupBy(issues.companyId),
      ]).then(([agentRows, issueRows]) => {
        const result: Record<string, { agentCount: number; issueCount: number }> = {};
        for (const row of agentRows) {
          result[row.companyId] = { agentCount: row.count, issueCount: 0 };
        }
        for (const row of issueRows) {
          if (result[row.companyId]) {
            result[row.companyId].issueCount = row.count;
          } else {
            result[row.companyId] = { agentCount: 0, issueCount: row.count };
          }
        }
        return result;
      }),
  };
}

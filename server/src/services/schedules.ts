import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentSchedules } from "@paperclipai/db";
import { CronExpressionParser } from "cron-parser";

function computeNextRunAt(cronExpression: string, _timezone: string): Date {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: new Date(),
    });
    return interval.next().toDate();
  } catch {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }
}

export function scheduleService(db: Db) {
  return {
    list: (companyId: string, agentId?: string) => {
      const conditions = [eq(agentSchedules.companyId, companyId)];
      if (agentId) {
        conditions.push(eq(agentSchedules.agentId, agentId));
      }
      return db
        .select()
        .from(agentSchedules)
        .where(and(...conditions))
        .orderBy(asc(agentSchedules.createdAt));
    },

    getById: (id: string) =>
      db
        .select()
        .from(agentSchedules)
        .where(eq(agentSchedules.id, id))
        .then((rows) => rows[0] ?? null),

    create: async (
      companyId: string,
      agentId: string,
      data: {
        cronExpression: string;
        timezone?: string;
        enabled?: boolean;
        label?: string | null;
        metadata?: Record<string, unknown> | null;
      },
    ) => {
      // Enforce per-agent schedule quota
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentSchedules)
        .where(and(eq(agentSchedules.companyId, companyId), eq(agentSchedules.agentId, agentId)));
      if (Number(countRow?.count ?? 0) >= 50) {
        throw new Error("Maximum 50 schedules per agent");
      }

      const timezone = data.timezone ?? "UTC";
      const nextRunAt = computeNextRunAt(data.cronExpression, timezone);
      return db
        .insert(agentSchedules)
        .values({
          companyId,
          agentId,
          cronExpression: data.cronExpression,
          timezone,
          enabled: data.enabled ?? true,
          label: data.label ?? null,
          metadata: data.metadata ?? null,
          nextRunAt,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    update: async (
      id: string,
      data: {
        cronExpression?: string;
        timezone?: string;
        enabled?: boolean;
        label?: string | null;
        metadata?: Record<string, unknown> | null;
      },
    ) => {
      const existing = await db
        .select()
        .from(agentSchedules)
        .where(eq(agentSchedules.id, id))
        .then((rows) => rows[0] ?? null);

      if (!existing) return null;

      const cronExpression = data.cronExpression ?? existing.cronExpression;
      const timezone = data.timezone ?? existing.timezone;
      const needsRecompute =
        data.cronExpression !== undefined || data.timezone !== undefined;

      const set: Record<string, unknown> = {
        ...data,
        updatedAt: new Date(),
      };

      if (needsRecompute) {
        set.nextRunAt = computeNextRunAt(cronExpression, timezone);
      }

      return db
        .update(agentSchedules)
        .set(set)
        .where(eq(agentSchedules.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    remove: (id: string) =>
      db
        .delete(agentSchedules)
        .where(eq(agentSchedules.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    getDueSchedules: (now: Date) =>
      db
        .select()
        .from(agentSchedules)
        .where(
          and(
            eq(agentSchedules.enabled, true),
            lte(agentSchedules.nextRunAt, now),
          ),
        )
        .orderBy(asc(agentSchedules.nextRunAt)),

    markRun: async (id: string, now: Date) => {
      const existing = await db
        .select()
        .from(agentSchedules)
        .where(eq(agentSchedules.id, id))
        .then((rows) => rows[0] ?? null);

      if (!existing) return null;

      const newNextRunAt = computeNextRunAt(
        existing.cronExpression,
        existing.timezone,
      );

      return db
        .update(agentSchedules)
        .set({
          lastRunAt: now,
          nextRunAt: newNextRunAt,
          updatedAt: now,
        })
        .where(eq(agentSchedules.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },
  };
}

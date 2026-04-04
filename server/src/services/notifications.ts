import { and, eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { notificationChannels, notificationRules } from "@paperclipai/db";
import type { LiveEvent } from "@paperclipai/shared";
import { logger } from "../middleware/logger.js";

function matchesEventPattern(pattern: string, eventType: string): boolean {
  if (pattern === "*") return true;
  if (pattern === eventType) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2) + ".";
    return eventType.startsWith(prefix);
  }
  return false;
}

export function validateOutboundUrl(url: string): void {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    "localhost", "127.0.0.1", "::1", "0.0.0.0",
    "169.254.169.254",
    "metadata.google.internal",
  ];
  if (blocked.includes(hostname)) {
    throw new Error("Blocked: internal hostname");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Blocked: unsupported protocol");
  }
  // IPv6 private/reserved ranges
  if (hostname.startsWith("[") || hostname.includes(":")) {
    const bare = hostname.replace(/^\[|\]$/g, "");
    if (bare.startsWith("fe80") || bare.startsWith("fc") || bare.startsWith("fd")) {
      throw new Error("Blocked: private IPv6");
    }
  }
  const parts = hostname.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
    if (parts[0] === 10) throw new Error("Blocked: private IP");
    if (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) throw new Error("Blocked: private IP");
    if (parts[0] === 192 && parts[1] === 168) throw new Error("Blocked: private IP");
    if (parts[0] === 127) throw new Error("Blocked: loopback IP");
    if (parts[0] === 0) throw new Error("Blocked: reserved IP");
  }
}

async function sendOutbound(url: string, body: unknown): Promise<void> {
  validateOutboundUrl(url);
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

export function notificationService(db: Db) {
  return {
    // ── Channel CRUD ──────────────────────────────────────────────

    createChannel: (
      companyId: string,
      data: {
        type: string;
        name?: string | null;
        config: Record<string, unknown>;
        enabled?: boolean;
      },
    ) =>
      db
        .insert(notificationChannels)
        .values({
          companyId,
          type: data.type,
          name: data.name ?? null,
          config: data.config,
          enabled: data.enabled ?? true,
        })
        .returning()
        .then((rows) => rows[0]),

    listChannels: (companyId: string) =>
      db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.companyId, companyId))
        .orderBy(desc(notificationChannels.createdAt)),

    getChannelById: (id: string) =>
      db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.id, id))
        .then((rows) => rows[0] ?? null),

    updateChannel: (id: string, data: Record<string, unknown>) =>
      db
        .update(notificationChannels)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationChannels.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    deleteChannel: (id: string) =>
      db
        .delete(notificationChannels)
        .where(eq(notificationChannels.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    // ── Rule CRUD ─────────────────────────────────────────────────

    createRule: (
      companyId: string,
      data: {
        channelId: string;
        eventPattern: string;
        filter?: Record<string, unknown> | null;
        enabled?: boolean;
      },
    ) =>
      db
        .insert(notificationRules)
        .values({
          companyId,
          channelId: data.channelId,
          eventPattern: data.eventPattern,
          filter: data.filter ?? null,
          enabled: data.enabled ?? true,
        })
        .returning()
        .then((rows) => rows[0]),

    listRules: (companyId: string) =>
      db
        .select()
        .from(notificationRules)
        .where(eq(notificationRules.companyId, companyId))
        .orderBy(desc(notificationRules.createdAt)),

    getRuleById: (id: string) =>
      db
        .select()
        .from(notificationRules)
        .where(eq(notificationRules.id, id))
        .then((rows) => rows[0] ?? null),

    updateRule: (id: string, data: Record<string, unknown>) =>
      db
        .update(notificationRules)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationRules.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    deleteRule: (id: string) =>
      db
        .delete(notificationRules)
        .where(eq(notificationRules.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    // ── Dispatch ──────────────────────────────────────────────────

    dispatchForEvent: async (event: LiveEvent): Promise<void> => {
      try {
        const rules = await db
          .select()
          .from(notificationRules)
          .where(
            and(
              eq(notificationRules.companyId, event.companyId),
              eq(notificationRules.enabled, true),
            ),
          );

        const matchedRules = rules.filter((rule) =>
          matchesEventPattern(rule.eventPattern, event.type),
        );

        for (const rule of matchedRules) {
          try {
            const channel = await db
              .select()
              .from(notificationChannels)
              .where(eq(notificationChannels.id, rule.channelId))
              .then((rows) => rows[0] ?? null);

            if (!channel || !channel.enabled) continue;

            if (channel.type === "webhook") {
              const url = (channel.config as any).url as string;
              await sendOutbound(url, { event });
            } else if (channel.type === "slack_webhook") {
              const webhookUrl = (channel.config as any).webhookUrl as string;
              await sendOutbound(webhookUrl, {
                text: `[Paperclip] ${event.type}: ${JSON.stringify(event.payload)}`,
              });
            }
          } catch (err) {
            logger.warn(
              { err, ruleId: rule.id, channelId: rule.channelId, eventType: event.type },
              "Failed to dispatch notification",
            );
          }
        }
      } catch (err) {
        logger.warn({ err, eventType: event.type }, "Failed to query notification rules");
      }
    },
  };
}

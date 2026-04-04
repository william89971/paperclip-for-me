import { and, eq, isNull, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentMessages } from "@paperclipai/db";

export function messageService(db: Db) {
  async function send(
    companyId: string,
    data: {
      fromAgentId: string;
      toAgentId: string;
      subject?: string | null;
      body: string;
      metadata?: Record<string, unknown> | null;
      replyToId?: string | null;
    },
  ) {
    // Validate replyToId exists and belongs to same company
    if (data.replyToId) {
      const parent = await db
        .select()
        .from(agentMessages)
        .where(eq(agentMessages.id, data.replyToId))
        .then((rows) => rows[0] ?? null);
      if (!parent || parent.companyId !== companyId) {
        throw new Error("Invalid replyToId: message not found in this company");
      }
    }

    const msg = await db
      .insert(agentMessages)
      .values({
        companyId,
        fromAgentId: data.fromAgentId,
        toAgentId: data.toAgentId,
        subject: data.subject ?? null,
        body: data.body,
        metadata: data.metadata ?? null,
        replyToId: data.replyToId ?? null,
      })
      .returning()
      .then((rows) => rows[0]);

    // Trigger wakeup for recipient (non-fatal)
    try {
      const { heartbeatService } = await import("./heartbeat.js");
      const hb = heartbeatService(db);
      await hb.wakeup(data.toAgentId, {
        source: "automation",
        triggerDetail: "callback",
        reason: "message_received",
        payload: {
          messageId: msg.id,
          fromAgentId: data.fromAgentId,
          subject: data.subject,
        },
      });
    } catch {
      // Wakeup failure is non-fatal; the message is already persisted.
    }

    return msg;
  }

  async function listInbox(
    companyId: string,
    agentId: string,
    opts?: { unreadOnly?: boolean },
  ) {
    const conditions = [
      eq(agentMessages.companyId, companyId),
      eq(agentMessages.toAgentId, agentId),
    ];
    if (opts?.unreadOnly) {
      conditions.push(isNull(agentMessages.readAt));
    }
    return db
      .select()
      .from(agentMessages)
      .where(and(...conditions))
      .orderBy(desc(agentMessages.createdAt));
  }

  async function listByCompany(companyId: string) {
    return db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.companyId, companyId))
      .orderBy(desc(agentMessages.createdAt))
      .limit(100);
  }

  async function markRead(id: string) {
    return db
      .update(agentMessages)
      .set({ readAt: new Date() })
      .where(and(eq(agentMessages.id, id), isNull(agentMessages.readAt)))
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  async function getById(id: string) {
    return db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.id, id))
      .then((rows) => rows[0] ?? null);
  }

  return {
    send,
    listInbox,
    listByCompany,
    markRead,
    getById,
  };
}

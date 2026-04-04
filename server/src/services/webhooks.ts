import { and, eq, desc } from "drizzle-orm";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { webhookEndpoints, webhookEvents } from "@paperclipai/db";

export function webhookService(db: Db) {
  async function createEndpoint(
    companyId: string,
    data: {
      slug: string;
      targetType: string;
      targetConfig?: Record<string, unknown>;
      enabled?: boolean;
    },
  ) {
    const secret = randomBytes(32).toString("hex");
    const [row] = await db
      .insert(webhookEndpoints)
      .values({
        companyId,
        slug: data.slug,
        secret,
        targetType: data.targetType,
        targetConfig: data.targetConfig ?? {},
        enabled: data.enabled ?? true,
      })
      .returning();
    return row;
  }

  const publicEndpointColumns = {
    id: webhookEndpoints.id,
    companyId: webhookEndpoints.companyId,
    slug: webhookEndpoints.slug,
    enabled: webhookEndpoints.enabled,
    targetType: webhookEndpoints.targetType,
    targetConfig: webhookEndpoints.targetConfig,
    createdAt: webhookEndpoints.createdAt,
    updatedAt: webhookEndpoints.updatedAt,
  };

  async function listEndpoints(companyId: string) {
    return db
      .select(publicEndpointColumns)
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.companyId, companyId))
      .orderBy(desc(webhookEndpoints.createdAt));
  }

  async function getEndpointById(id: string) {
    const [row] = await db
      .select(publicEndpointColumns)
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, id));
    return row ?? null;
  }

  async function getEndpointBySlug(slug: string) {
    const [row] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.slug, slug));
    return row ?? null;
  }

  async function updateEndpoint(
    id: string,
    data: Partial<{
      slug: string;
      targetType: string;
      targetConfig: Record<string, unknown>;
      enabled: boolean;
    }>,
  ) {
    const [row] = await db
      .update(webhookEndpoints)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(webhookEndpoints.id, id))
      .returning();
    return row ?? null;
  }

  async function deleteEndpoint(id: string) {
    const [row] = await db
      .delete(webhookEndpoints)
      .where(eq(webhookEndpoints.id, id))
      .returning();
    return row ?? null;
  }

  function validateSignature(
    secret: string,
    rawBody: string,
    signatureHeader: string,
  ): boolean {
    try {
      const expected = createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");
      const provided = signatureHeader.startsWith("sha256=")
        ? signatureHeader.slice("sha256=".length)
        : signatureHeader;

      const expectedBuf = Buffer.from(expected, "hex");
      const providedBuf = Buffer.from(provided, "hex");

      if (expectedBuf.length !== providedBuf.length) {
        return false;
      }
      return timingSafeEqual(expectedBuf, providedBuf);
    } catch {
      return false;
    }
  }

  async function processEvent(
    endpointId: string,
    companyId: string,
    headers: Record<string, string>,
    payload: Record<string, unknown>,
  ) {
    const [event] = await db
      .insert(webhookEvents)
      .values({
        endpointId,
        companyId,
        headers,
        payload,
        status: "received",
      })
      .returning();

    const endpoint = await getEndpointById(endpointId);
    if (!endpoint) {
      await db
        .update(webhookEvents)
        .set({ status: "failed", error: "Endpoint not found", processedAt: new Date() })
        .where(eq(webhookEvents.id, event.id));
      return event;
    }

    try {
      switch (endpoint.targetType) {
        case "create_issue": {
          const { issueService } = await import("./issues.js");
          const issueSvc = issueService(db);
          const title =
            typeof payload.title === "string" && payload.title
              ? payload.title
              : "Webhook event";
          const description =
            typeof payload.description === "string" && payload.description
              ? payload.description
              : JSON.stringify(payload);
          const created = await issueSvc.create(companyId, { title, description });
          await db
            .update(webhookEvents)
            .set({
              status: "processed",
              processedAt: new Date(),
              resultEntityId: created.id,
            })
            .where(eq(webhookEvents.id, event.id));
          break;
        }
        case "wake_agent": {
          const { heartbeatService } = await import("./heartbeat.js");
          const { agentService } = await import("./agents.js");
          const heartbeat = heartbeatService(db);
          const agentSvc = agentService(db);
          const agentId =
            (endpoint.targetConfig as Record<string, unknown>)?.agentId as
              | string
              | undefined;
          if (agentId) {
            // Verify agent belongs to the same company as the webhook
            const targetAgent = await agentSvc.getById(agentId);
            if (!targetAgent || targetAgent.companyId !== companyId) {
              throw new Error("Target agent not found in this company");
            }
            await heartbeat.wakeup(agentId, { source: "automation" });
          }
          await db
            .update(webhookEvents)
            .set({ status: "processed", processedAt: new Date() })
            .where(eq(webhookEvents.id, event.id));
          break;
        }
        case "custom": {
          await db
            .update(webhookEvents)
            .set({ status: "processed", processedAt: new Date() })
            .where(eq(webhookEvents.id, event.id));
          break;
        }
        default: {
          await db
            .update(webhookEvents)
            .set({
              status: "failed",
              error: `Unknown target type: ${endpoint.targetType}`,
              processedAt: new Date(),
            })
            .where(eq(webhookEvents.id, event.id));
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(webhookEvents)
        .set({ status: "failed", error: message, processedAt: new Date() })
        .where(eq(webhookEvents.id, event.id));
    }

    return event;
  }

  async function listEvents(companyId: string, endpointId?: string) {
    const conditions = [eq(webhookEvents.companyId, companyId)];
    if (endpointId) {
      conditions.push(eq(webhookEvents.endpointId, endpointId));
    }
    return db
      .select()
      .from(webhookEvents)
      .where(and(...conditions))
      .orderBy(desc(webhookEvents.createdAt))
      .limit(100);
  }

  return {
    createEndpoint,
    listEndpoints,
    getEndpointById,
    getEndpointBySlug,
    updateEndpoint,
    deleteEndpoint,
    validateSignature,
    processEvent,
    listEvents,
  };
}

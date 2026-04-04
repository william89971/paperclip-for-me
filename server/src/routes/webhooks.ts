import express, { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, webhookService } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function webhookPublicRoutes(db: Db) {
  const router = Router();
  const svc = webhookService(db);

  // Use raw body for HMAC validation, parse JSON after verification
  router.post("/:slug", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    const endpoint = await svc.getEndpointBySlug(req.params.slug as string);
    if (!endpoint || !endpoint.enabled) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const signatureHeader = req.headers["x-webhook-signature"] as string | undefined;
    if (!signatureHeader) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body) ? (req.body as Buffer).toString("utf8") : String(req.body);
    if (!svc.validateSignature(endpoint.secret, rawBody, signatureHeader)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    const event = await svc.processEvent(
      endpoint.id,
      endpoint.companyId,
      req.headers as Record<string, string>,
      payload,
    );

    res.status(200).json({ ok: true, eventId: event.id });
  });

  return router;
}

export function webhookManagementRoutes(db: Db) {
  const router = Router();
  const svc = webhookService(db);

  router.get("/companies/:companyId/webhooks", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const endpoints = await svc.listEndpoints(companyId);
    res.json(endpoints);
  });

  router.post(
    "/companies/:companyId/webhooks",
    validate(createWebhookEndpointSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);

      const endpoint = await svc.createEndpoint(companyId, {
        slug: req.body.slug,
        targetType: req.body.targetType,
        targetConfig: req.body.targetConfig,
        enabled: req.body.enabled,
      });

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "webhook_endpoint.created",
        entityType: "webhook_endpoint",
        entityId: endpoint.id,
        agentId: actor.agentId,
        runId: actor.runId,
        details: { slug: endpoint.slug, targetType: endpoint.targetType },
      });

      res.status(201).json(endpoint);
    },
  );

  router.patch(
    "/webhooks/:id",
    validate(updateWebhookEndpointSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const existing = await svc.getEndpointById(id);
      if (!existing) {
        res.status(404).json({ error: "Webhook endpoint not found" });
        return;
      }
      assertCompanyAccess(req, existing.companyId);
      const actor = getActorInfo(req);

      const updated = await svc.updateEndpoint(id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Webhook endpoint not found" });
        return;
      }

      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "webhook_endpoint.updated",
        entityType: "webhook_endpoint",
        entityId: id,
        agentId: actor.agentId,
        runId: actor.runId,
        details: req.body,
      });

      res.json(updated);
    },
  );

  router.delete("/webhooks/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getEndpointById(id);
    if (!existing) {
      res.status(404).json({ error: "Webhook endpoint not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const actor = getActorInfo(req);

    const deleted = await svc.deleteEndpoint(id);
    if (!deleted) {
      res.status(404).json({ error: "Webhook endpoint not found" });
      return;
    }

    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "webhook_endpoint.deleted",
      entityType: "webhook_endpoint",
      entityId: id,
      agentId: actor.agentId,
      runId: actor.runId,
      details: { slug: existing.slug },
    });

    res.json(deleted);
  });

  router.get(
    "/companies/:companyId/webhooks/:endpointId/events",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const events = await svc.listEvents(companyId, req.params.endpointId as string);
      res.json(events);
    },
  );

  return router;
}

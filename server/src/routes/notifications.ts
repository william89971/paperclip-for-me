import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createNotificationChannelSchema,
  updateNotificationChannelSchema,
  createNotificationRuleSchema,
  updateNotificationRuleSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { notificationService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function notificationRoutes(db: Db) {
  const router = Router();
  const svc = notificationService(db);

  // ── Channel routes ────────────────────────────────────────────

  router.get("/companies/:companyId/notifications/channels", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const channels = await svc.listChannels(companyId);
    res.json(channels);
  });

  router.post(
    "/companies/:companyId/notifications/channels",
    validate(createNotificationChannelSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const channel = await svc.createChannel(companyId, {
        type: req.body.type,
        name: req.body.name,
        config: req.body.config,
        enabled: req.body.enabled,
      });

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "notification.channel_created",
        entityType: "notification_channel",
        entityId: channel.id,
        details: { type: channel.type, name: channel.name },
      });

      res.status(201).json(channel);
    },
  );

  router.patch(
    "/notifications/channels/:id",
    validate(updateNotificationChannelSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const existing = await svc.getChannelById(id);
      if (!existing) {
        res.status(404).json({ error: "Notification channel not found" });
        return;
      }
      assertCompanyAccess(req, existing.companyId);

      const updated = await svc.updateChannel(id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Notification channel not found" });
        return;
      }

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "notification.channel_updated",
        entityType: "notification_channel",
        entityId: updated.id,
        details: req.body,
      });

      res.json(updated);
    },
  );

  router.delete("/notifications/channels/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getChannelById(id);
    if (!existing) {
      res.status(404).json({ error: "Notification channel not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const removed = await svc.deleteChannel(id);
    if (!removed) {
      res.status(404).json({ error: "Notification channel not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "notification.channel_deleted",
      entityType: "notification_channel",
      entityId: removed.id,
      details: { type: removed.type, name: removed.name },
    });

    res.json(removed);
  });

  // ── Rule routes ───────────────────────────────────────────────

  router.get("/companies/:companyId/notifications/rules", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const rules = await svc.listRules(companyId);
    res.json(rules);
  });

  router.post(
    "/companies/:companyId/notifications/rules",
    validate(createNotificationRuleSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify channel belongs to this company
      const channel = await svc.getChannelById(req.body.channelId);
      if (!channel || channel.companyId !== companyId) {
        res.status(422).json({ error: "Channel not found in this company" });
        return;
      }

      const rule = await svc.createRule(companyId, {
        channelId: req.body.channelId,
        eventPattern: req.body.eventPattern,
        filter: req.body.filter,
        enabled: req.body.enabled,
      });

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "notification.rule_created",
        entityType: "notification_rule",
        entityId: rule.id,
        details: { channelId: rule.channelId, eventPattern: rule.eventPattern },
      });

      res.status(201).json(rule);
    },
  );

  router.patch(
    "/notifications/rules/:id",
    validate(updateNotificationRuleSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const existing = await svc.getRuleById(id);
      if (!existing) {
        res.status(404).json({ error: "Notification rule not found" });
        return;
      }
      assertCompanyAccess(req, existing.companyId);

      const updated = await svc.updateRule(id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Notification rule not found" });
        return;
      }

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "notification.rule_updated",
        entityType: "notification_rule",
        entityId: updated.id,
        details: req.body,
      });

      res.json(updated);
    },
  );

  router.delete("/notifications/rules/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getRuleById(id);
    if (!existing) {
      res.status(404).json({ error: "Notification rule not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const removed = await svc.deleteRule(id);
    if (!removed) {
      res.status(404).json({ error: "Notification rule not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "notification.rule_deleted",
      entityType: "notification_rule",
      entityId: removed.id,
      details: { channelId: removed.channelId, eventPattern: removed.eventPattern },
    });

    res.json(removed);
  });

  return router;
}

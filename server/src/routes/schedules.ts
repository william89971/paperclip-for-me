import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createScheduleSchema, updateScheduleSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { scheduleService, agentService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function scheduleRoutes(db: Db) {
  const router = Router();
  const scheduleSvc = scheduleService(db);
  const agentSvc = agentService(db);

  router.get("/agents/:agentId/schedules", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agentSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);
    const schedules = await scheduleSvc.list(agent.companyId, agentId);
    res.json(schedules);
  });

  router.post("/agents/:agentId/schedules", validate(createScheduleSchema), async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agentSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const schedule = await scheduleSvc.create(agent.companyId, agentId, {
      cronExpression: req.body.cronExpression,
      timezone: req.body.timezone,
      enabled: req.body.enabled,
      label: req.body.label,
      metadata: req.body.metadata,
    });

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "schedule.created",
      entityType: "schedule",
      entityId: schedule.id,
      details: { label: schedule.label, cronExpression: schedule.cronExpression },
    });

    res.status(201).json(schedule);
  });

  router.patch("/schedules/:id", validate(updateScheduleSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await scheduleSvc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }

    const agent = await agentSvc.getById(existing.agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const updated = await scheduleSvc.update(id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "schedule.updated",
      entityType: "schedule",
      entityId: updated.id,
      details: req.body,
    });

    res.json(updated);
  });

  router.delete("/schedules/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await scheduleSvc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }

    const agent = await agentSvc.getById(existing.agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const removed = await scheduleSvc.remove(id);
    if (!removed) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "schedule.deleted",
      entityType: "schedule",
      entityId: removed.id,
      details: { label: removed.label },
    });

    res.json(removed);
  });

  return router;
}

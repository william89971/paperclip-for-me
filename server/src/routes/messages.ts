import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { sendMessageSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { messageService, agentService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function messageRoutes(db: Db) {
  const router = Router();
  const svc = messageService(db);
  const agentSvc = agentService(db);

  router.get("/companies/:companyId/messages", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.listByCompany(companyId);
    res.json(result);
  });

  router.post("/companies/:companyId/messages", validate(sendMessageSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    // Prevent agent impersonation: agents can only send as themselves
    if (req.actor.type === "agent" && req.body.fromAgentId !== req.actor.agentId) {
      res.status(403).json({ error: "Agents can only send messages as themselves" });
      return;
    }
    // Verify fromAgentId belongs to this company
    const fromAgent = await agentSvc.getById(req.body.fromAgentId);
    if (!fromAgent || fromAgent.companyId !== companyId) {
      res.status(422).json({ error: "fromAgentId not found in this company" });
      return;
    }

    const msg = await svc.send(companyId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "message.sent",
      entityType: "message",
      entityId: msg.id,
      details: {
        fromAgentId: msg.fromAgentId,
        toAgentId: msg.toAgentId,
        subject: msg.subject,
      },
    });
    res.status(201).json(msg);
  });

  router.get("/agents/:agentId/inbox", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agentSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);
    const unreadOnly = req.query.unreadOnly === "true";
    const result = await svc.listInbox(agent.companyId, agentId, { unreadOnly });
    res.json(result);
  });

  router.get("/messages/:id", async (req, res) => {
    const id = req.params.id as string;
    const msg = await svc.getById(id);
    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    assertCompanyAccess(req, msg.companyId);
    res.json(msg);
  });

  router.patch("/messages/:id/read", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const updated = await svc.markRead(id);
    if (updated) {
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "message.read",
        entityType: "message",
        entityId: id,
      });
    }
    res.json(updated ?? existing);
  });

  return router;
}

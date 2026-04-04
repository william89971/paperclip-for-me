import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createKnowledgeEntrySchema, updateKnowledgeEntrySchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { knowledgeService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function knowledgeRoutes(db: Db) {
  const router = Router();
  const svc = knowledgeService(db);

  router.get("/companies/:companyId/knowledge", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const category = req.query.category as string | undefined;
    const result = await svc.list(companyId, category);
    res.json(result);
  });

  router.get("/companies/:companyId/knowledge/search", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const q = req.query.q as string | undefined;
    if (!q) {
      res.status(400).json({ error: "Missing required query parameter: q" });
      return;
    }
    const result = await svc.search(companyId, q);
    res.json(result);
  });

  router.post("/companies/:companyId/knowledge", validate(createKnowledgeEntrySchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actorAgentId = req.actor.type === "agent" ? req.actor.agentId : undefined;
    const entry = await svc.create(companyId, req.body, actorAgentId ?? undefined);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "knowledge.created",
      entityType: "knowledge_entry",
      entityId: entry.id,
      details: { title: entry.title },
    });

    res.status(201).json(entry);
  });

  router.get("/knowledge/:id", async (req, res) => {
    const id = req.params.id as string;
    const entry = await svc.getById(id);
    if (!entry) {
      res.status(404).json({ error: "Knowledge entry not found" });
      return;
    }
    assertCompanyAccess(req, entry.companyId);
    res.json(entry);
  });

  router.patch("/knowledge/:id", validate(updateKnowledgeEntrySchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Knowledge entry not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const actorAgentId = req.actor.type === "agent" ? req.actor.agentId : undefined;
    const entry = await svc.update(id, req.body, actorAgentId ?? undefined);
    if (!entry) {
      res.status(404).json({ error: "Knowledge entry not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: entry.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "knowledge.updated",
      entityType: "knowledge_entry",
      entityId: entry.id,
      details: req.body,
    });

    res.json(entry);
  });

  router.delete("/knowledge/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Knowledge entry not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const entry = await svc.remove(id);
    if (!entry) {
      res.status(404).json({ error: "Knowledge entry not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: entry.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "knowledge.deleted",
      entityType: "knowledge_entry",
      entityId: entry.id,
    });

    res.json(entry);
  });

  return router;
}

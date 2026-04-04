import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { generateBriefingSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { briefingService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function briefingRoutes(db: Db) {
  const router = Router();
  const svc = briefingService(db);

  router.post(
    "/companies/:companyId/briefings/generate",
    validate(generateBriefingSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const briefing = await svc.generate(companyId);
      const actor = getActorInfo(req);

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "briefing.generated",
        entityType: "briefing",
        entityId: briefing.id,
      });

      res.status(201).json(briefing);
    },
  );

  router.get("/companies/:companyId/briefings/latest", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const briefing = await svc.getLatest(companyId);

    if (!briefing) {
      res.status(404).json({ error: "No briefing found for this company" });
      return;
    }

    res.json(briefing);
  });

  return router;
}

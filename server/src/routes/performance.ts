import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { performanceService, agentService } from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";

export function performanceRoutes(db: Db) {
  const router = Router();
  const perf = performanceService(db);
  const agents = agentService(db);

  router.get("/agents/:agentId/performance", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const rangeStr = (req.query.range as string) || "30d";
    const rangeDays = Math.max(1, Math.min(365, parseInt(rangeStr, 10) || 30));

    const result = await perf.getAgentPerformance(agentId, rangeDays);
    res.json(result);
  });

  return router;
}

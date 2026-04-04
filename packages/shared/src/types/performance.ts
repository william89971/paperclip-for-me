export interface AgentPerformance {
  agentId: string;
  range: string;
  successRate: number;
  totalRuns: number;
  avgDurationMs: number | null;
  tasksCompleted: number;
  avgCycleTimeHours: number | null;
  totalCostCents: number;
  costPerTask: number | null;
}

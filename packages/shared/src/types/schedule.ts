export interface AgentSchedule {
  id: string;
  companyId: string;
  agentId: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  label: string | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMessage {
  id: string;
  companyId: string;
  fromAgentId: string;
  toAgentId: string;
  subject: string | null;
  body: string;
  metadata: Record<string, unknown> | null;
  readAt: Date | null;
  replyToId: string | null;
  createdAt: Date;
}

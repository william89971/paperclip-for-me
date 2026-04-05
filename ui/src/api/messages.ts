import { api } from "./client";

export interface AgentMessage {
  id: string;
  companyId: string;
  fromAgentId: string;
  toAgentId: string;
  subject: string | null;
  body: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  replyToId: string | null;
  createdAt: string;
}

export const messagesApi = {
  list: (companyId: string) =>
    api.get<AgentMessage[]>(`/companies/${companyId}/messages`),
};

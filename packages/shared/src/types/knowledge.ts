export interface KnowledgeEntry {
  id: string;
  companyId: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[] | null;
  createdByAgentId: string | null;
  updatedByAgentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

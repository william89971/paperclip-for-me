export interface CompanyBriefing {
  id: string;
  companyId: string;
  content: string;
  generatedAt: Date;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

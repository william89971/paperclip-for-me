import type { WebhookTargetType, WebhookEventStatus } from "../constants.js";

export interface WebhookEndpoint {
  id: string;
  companyId: string;
  slug: string;
  secret: string;
  enabled: boolean;
  targetType: WebhookTargetType;
  targetConfig: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  endpointId: string;
  companyId: string;
  headers: Record<string, string> | null;
  payload: Record<string, unknown> | null;
  status: WebhookEventStatus;
  processedAt: Date | null;
  resultEntityId: string | null;
  error: string | null;
  createdAt: Date;
}

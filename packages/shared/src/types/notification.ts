import type { NotificationChannelType } from "../constants.js";

export interface NotificationChannel {
  id: string;
  companyId: string;
  type: NotificationChannelType;
  name: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRule {
  id: string;
  companyId: string;
  channelId: string;
  eventPattern: string;
  filter: Record<string, unknown> | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

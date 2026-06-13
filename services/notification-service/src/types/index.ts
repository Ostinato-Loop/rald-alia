export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface WebhookPayload {
  url: string;
  event: string;
  data: Record<string, unknown>;
  secret: string;
}

export interface SmsPayload {
  to: string;
  message: string;
}

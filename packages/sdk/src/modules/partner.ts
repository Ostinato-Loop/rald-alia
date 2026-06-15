// packages/sdk/src/modules/partner.ts
// ALIA Partner SDK — registration, webhook management, integration onboarding.
// Supports: banks, processors, wallets, mobile money, card issuers, governments, merchants.

import type { AliaHttpClient }                    from '../client';
import type {
  Partner,
  RegisterPartnerParams,
  WebhookConfig,
  CreateWebhookParams,
  UpdateWebhookParams,
  WebhookTestResult,
} from '../types';

/**
 * PartnerClient — ALIA Connect integration onboarding and webhook management.
 *
 * Required scopes:
 *   - partner:register  → register()
 *   - partner:read      → get(), sandbox()
 *   - partner:webhooks  → createWebhook(), listWebhooks(), deleteWebhook(), testWebhook()
 *
 * @example
 * ```ts
 * // Register as a processor partner (e.g. Paystack-style integration)
 * const partner = await alia.partner.register({
 *   name:          'Paystack',
 *   type:          'processor',
 *   country:       'NG',
 *   contact_email: 'integrations@paystack.com',
 *   website_url:   'https://paystack.com',
 * });
 *
 * // Set up a webhook endpoint
 * await alia.partner.createWebhook({
 *   url:    'https://paystack.com/webhooks/alia',
 *   events: ['payment.completed', 'identity.resolved', 'consent.granted'],
 * });
 * ```
 */
export class PartnerClient {
  constructor(private readonly http: AliaHttpClient) {}

  /**
   * Register your institution as an ALIA Connect partner.
   * Returns credentials + scopes. Store the returned api_key securely.
   */
  register(params: RegisterPartnerParams): Promise<Partner> {
    return this.http.request<Partner>({
      method: 'POST',
      path:   '/v1/partner/register',
      body:   params,
    });
  }

  /**
   * Fetch the current partner profile associated with this API key.
   */
  get(): Promise<Partner> {
    return this.http.request<Partner>({ path: '/v1/partner/profile' });
  }

  /**
   * Update partner profile (webhook URL, display name, logo).
   */
  update(params: Partial<Pick<RegisterPartnerParams, 'webhook_url' | 'website_url'>>): Promise<Partner> {
    return this.http.request<Partner>({
      method: 'PATCH',
      path:   '/v1/partner/profile',
      body:   params,
    });
  }

  /**
   * Get sandbox credentials for testing without real transactions.
   */
  sandbox(): Promise<{ api_key: string; base_url: string; test_aliases: string[] }> {
    return this.http.request({ path: '/v1/partner/sandbox' });
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  /**
   * Register a webhook endpoint.
   *
   * Supported events:
   *   payment.*   — payment.initiated, payment.completed, payment.failed
   *   identity.*  — identity.resolved, identity.verified, identity.failed
   *   consent.*   — consent.granted, consent.revoked, consent.expired
   *   trust.*     — trust.updated
   *   alias.*     — alias.created, alias.suspended
   */
  createWebhook(params: CreateWebhookParams): Promise<WebhookConfig> {
    return this.http.request<WebhookConfig>({
      method: 'POST',
      path:   '/v1/partner/webhooks',
      body:   params,
    });
  }

  listWebhooks(): Promise<WebhookConfig[]> {
    return this.http.request<WebhookConfig[]>({ path: '/v1/partner/webhooks' });
  }

  updateWebhook(webhookId: string, params: UpdateWebhookParams): Promise<WebhookConfig> {
    return this.http.request<WebhookConfig>({
      method: 'PATCH',
      path:   `/v1/partner/webhooks/${webhookId}`,
      body:   params,
    });
  }

  deleteWebhook(webhookId: string): Promise<void> {
    return this.http.request<void>({
      method: 'DELETE',
      path:   `/v1/partner/webhooks/${webhookId}`,
    });
  }

  /**
   * Send a test event to a webhook endpoint to verify connectivity.
   */
  testWebhook(webhookId: string, event?: string): Promise<WebhookTestResult> {
    return this.http.request<WebhookTestResult>({
      method: 'POST',
      path:   `/v1/partner/webhooks/${webhookId}/test`,
      body:   { event: event ?? 'payment.completed' },
    });
  }

  /**
   * Verify an incoming ALIA webhook signature.
   * Use this in your webhook handler to prevent spoofed events.
   *
   * @example
   * ```ts
   * // Express handler
   * app.post('/webhooks/alia', express.raw({ type: 'application/json' }), async (req, res) => {
   *   const valid = await alia.partner.verifyWebhookSignature(
   *     req.body.toString(),
   *     req.headers['x-alia-signature'] as string,
   *     process.env.ALIA_WEBHOOK_SECRET!,
   *   );
   *   if (!valid) return res.status(401).send('Invalid signature');
   *   // process event...
   *   res.sendStatus(200);
   * });
   * ```
   */
  async verifyWebhookSignature(
    payload:   string,
    signature: string,
    secret:    string,
  ): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const hex    = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const expected = `sha256=${hex}`;
    return expected === signature;
  }
}

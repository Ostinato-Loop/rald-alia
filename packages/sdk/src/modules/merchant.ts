// packages/sdk/src/modules/merchant.ts
// ALIA Merchant SDK — register merchants, create checkout sessions, manage merchant identity.
//
// Merchant receives:
//   ALIA Merchant ID · ALIA Checkout · ALIA Trust Score · ALIA Customer Identity
//
// Merchant NEVER stores:
//   Card details · Bank account numbers · Sensitive customer financial data

import type { AliaHttpClient }                              from '../client';
import type { Merchant, RegisterMerchantParams, CheckoutSession, CreateCheckoutParams } from '../types';

/**
 * MerchantClient — register merchants and create ALIA Checkout sessions.
 *
 * Required scopes:
 *   - merchant:register   → register()
 *   - merchant:read       → get(), list()
 *   - merchant:checkout   → createCheckout(), getCheckout()
 *
 * @example Activate ALIA Checkout in under 15 minutes
 * ```ts
 * // Step 1: Register your merchant (one-time)
 * const merchant = await alia.merchant.register({
 *   name:        'My Store',
 *   alias:       'mystore',         // becomes mystore@rald
 *   category:    'retail',
 *   country:     'NG',
 *   webhook_url: 'https://mystore.com/webhooks/alia',
 * });
 *
 * // Step 2: Create a checkout session per order
 * const session = await alia.merchant.createCheckout({
 *   amount_minor: 25_000_00,        // 25,000 NGN in kobo
 *   currency:     'NGN',
 *   reference:    'ORDER-4892',
 *   redirect_url: 'https://mystore.com/order/success',
 *   narration:    'Order #4892 — 3x Ankara fabric',
 * });
 *
 * // Step 3: Redirect customer to session.checkout_url
 * // ALIA handles identity resolution, consent, and routing.
 * // Your processor handles settlement.
 * ```
 */
export class MerchantClient {
  constructor(private readonly http: AliaHttpClient) {}

  /**
   * Register a new merchant. Returns credentials + public checkout key.
   * Time to integration: < 15 minutes.
   */
  register(params: RegisterMerchantParams): Promise<Merchant> {
    return this.http.request<Merchant>({
      method: 'POST',
      path:   '/v1/merchant/register',
      body:   params,
    });
  }

  /**
   * Fetch the merchant profile for the authenticated API key.
   */
  get(merchantId?: string): Promise<Merchant> {
    return this.http.request<Merchant>({
      path: merchantId ? `/v1/merchants/${merchantId}` : '/v1/merchant/profile',
    });
  }

  /**
   * Look up a merchant by their ALIA alias (e.g. "netflix@rald").
   */
  getByAlias(alias: string): Promise<Merchant> {
    return this.http.request<Merchant>({ path: `/v1/merchants/alias/${encodeURIComponent(alias)}` });
  }

  // ── Checkout ──────────────────────────────────────────────────────────────

  /**
   * Create an ALIA Checkout session.
   * Returns a `checkout_url` — redirect your customer there.
   * ALIA handles identity, consent, and routing. Your processor handles settlement.
   */
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutSession> {
    return this.http.request<CheckoutSession>({
      method: 'POST',
      path:   '/v1/merchant/checkout',
      body:   params,
    });
  }

  /**
   * Fetch a checkout session by ID. Poll to check completion status.
   */
  getCheckout(sessionId: string): Promise<CheckoutSession> {
    return this.http.request<CheckoutSession>({ path: `/v1/merchant/checkout/${sessionId}` });
  }

  /**
   * Expire an open checkout session (e.g. order was cancelled).
   */
  expireCheckout(sessionId: string): Promise<void> {
    return this.http.request<void>({
      method: 'DELETE',
      path:   `/v1/merchant/checkout/${sessionId}`,
    });
  }
}

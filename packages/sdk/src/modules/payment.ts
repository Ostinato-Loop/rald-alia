// packages/sdk/src/modules/payment.ts
// ALIA Payment SDK — initiate and verify consumer payments over the ALIA network.
//
// ALIA sits above existing payment rails:
//   Customer → Email/Phone/Username → ALIA → Existing Institution → Existing Payment Rail
//
// ALIA provides: Identity · Authorization · Consent · Routing · Trust
// Your processor (Paystack, Flutterwave, Squad, etc.) remains the settlement engine.

import type { AliaHttpClient }                           from '../client';
import type { Payment, InitiatePaymentParams, VerifyPaymentParams } from '../types';

/**
 * PaymentClient — initiate and verify ALIA-routed payments.
 *
 * Required scopes:
 *   - payments:initiate  → initiate()
 *   - payments:verify    → verify(), get()
 *   - payments:list      → list()
 *
 * @example Paystack integration mode
 * ```ts
 * // 1. Customer clicks "Pay with ALIA"
 * // 2. Customer enters their ALIA alias (e.g. phone or email)
 * // 3. ALIA resolves the alias → routing metadata
 * // 4. You initiate via Paystack as normal — ALIA only provided identity + routing
 *
 * const payment = await alia.payments.initiate({
 *   source_alias:      '+2348012345678',        // payer's ALIA alias
 *   destination_alias: 'store@rald',            // merchant's ALIA alias
 *   amount_minor:      15_000_00,               // 15,000 NGN in kobo
 *   currency:          'NGN',
 *   narration:         'Order #4892',
 *   idempotency_key:   crypto.randomUUID(),
 * });
 *
 * // Paystack still processes settlement. ALIA only provided:
 * //   ✓ Identity verification
 * //   ✓ Authorization
 * //   ✓ Consent
 * //   ✓ Routing metadata
 * //   ✓ Trust score
 * ```
 */
export class PaymentClient {
  constructor(private readonly http: AliaHttpClient) {}

  /**
   * Initiate an ALIA-routed payment.
   * ALIA resolves both aliases, validates consent, checks trust, and returns
   * routing metadata for your settlement processor.
   */
  initiate(params: InitiatePaymentParams): Promise<Payment> {
    return this.http.request<Payment>({
      method: 'POST',
      path:   '/v1/payments/initiate',
      body:   params,
    });
  }

  /**
   * Verify a payment by ID or processor reference.
   */
  verify(params: VerifyPaymentParams): Promise<Payment> {
    return this.http.request<Payment>({
      method: 'POST',
      path:   '/v1/payments/verify',
      body:   params,
    });
  }

  /**
   * Fetch a payment by its ALIA payment ID.
   */
  get(paymentId: string): Promise<Payment> {
    return this.http.request<Payment>({ path: `/v1/payments/${paymentId}` });
  }

  /**
   * List payments for the authenticated partner/merchant.
   */
  list(params?: {
    page?:     number;
    limit?:    number;
    status?:   string;
    currency?: string;
    from?:     string;
    to?:       string;
  }): Promise<Payment[]> {
    return this.http.request<Payment[]>({
      path:  '/v1/payments',
      query: params as Record<string, string | number | boolean | undefined>,
    });
  }
}

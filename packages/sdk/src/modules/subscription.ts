// packages/sdk/src/modules/subscription.ts
// ALIA Subscription Engine — recurring billing via ALIA identity.
//
// Customers authorize recurring payments once using their ALIA alias.
// Merchants never store payment credentials — ALIA manages renewal consent.

import type { AliaHttpClient }                                        from '../client';
import type { Subscription, CreateSubscriptionParams, CancelSubscriptionParams, SubscriptionPlan } from '../types';

/**
 * SubscriptionClient — create and manage recurring billing via ALIA.
 *
 * Required scopes:
 *   - subscriptions:create  → create()
 *   - subscriptions:read    → get(), list()
 *   - subscriptions:cancel  → cancel()
 *   - subscriptions:plans   → createPlan(), listPlans(), getPlan()
 *
 * @example Recurring subscription (e.g. Spotify-style)
 * ```ts
 * // Step 1: Create a plan (one-time setup)
 * const plan = await alia.subscriptions.createPlan({
 *   name:         'Premium Monthly',
 *   amount_minor: 5_000_00,     // 5,000 NGN/month
 *   currency:     'NGN',
 *   interval:     'monthly',
 * });
 *
 * // Step 2: Subscribe a customer by their ALIA alias
 * const sub = await alia.subscriptions.create({
 *   customer_alias:  '+2348012345678',   // customer's phone alias
 *   plan_id:         plan.id,
 *   idempotency_key: crypto.randomUUID(),
 * });
 *
 * // ALIA:
 * //   ✓ Verifies customer identity
 * //   ✓ Requests consent for recurring billing
 * //   ✓ Routes renewal charges via existing payment rails
 * // Merchant never sees card/bank details.
 * ```
 */
export class SubscriptionClient {
  constructor(private readonly http: AliaHttpClient) {}

  // ── Subscriptions ─────────────────────────────────────────────────────────

  /**
   * Create a new subscription. Triggers a consent request to the customer
   * if they haven't previously authorized this merchant.
   */
  create(params: CreateSubscriptionParams): Promise<Subscription> {
    return this.http.request<Subscription>({
      method: 'POST',
      path:   '/v1/subscriptions/create',
      body:   params,
    });
  }

  /** Fetch a subscription by ID. */
  get(subscriptionId: string): Promise<Subscription> {
    return this.http.request<Subscription>({ path: `/v1/subscriptions/${subscriptionId}` });
  }

  /** List subscriptions for this merchant. */
  list(params?: {
    status?:   string;
    plan_id?:  string;
    page?:     number;
    limit?:    number;
  }): Promise<Subscription[]> {
    return this.http.request<Subscription[]>({
      path:  '/v1/subscriptions',
      query: params as Record<string, string | number | boolean | undefined>,
    });
  }

  /**
   * Cancel a subscription.
   * By default, cancels at period end. Pass `cancel_at_period_end: false` to cancel immediately.
   */
  cancel(subscriptionId: string, params?: CancelSubscriptionParams): Promise<Subscription> {
    return this.http.request<Subscription>({
      method: 'POST',
      path:   `/v1/subscriptions/cancel`,
      body:   { subscription_id: subscriptionId, ...params },
    });
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  /** Create a billing plan (one-time setup per product tier). */
  createPlan(params: {
    name:         string;
    amount_minor: number;
    currency:     string;
    interval:     'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    description?: string;
    trial_days?:  number;
    metadata?:    Record<string, unknown>;
  }): Promise<SubscriptionPlan> {
    return this.http.request<SubscriptionPlan>({
      method: 'POST',
      path:   '/v1/subscriptions/plans',
      body:   params,
    });
  }

  /** Fetch a plan by ID. */
  getPlan(planId: string): Promise<SubscriptionPlan> {
    return this.http.request<SubscriptionPlan>({ path: `/v1/subscriptions/plans/${planId}` });
  }

  /** List all plans for this merchant. */
  listPlans(): Promise<SubscriptionPlan[]> {
    return this.http.request<SubscriptionPlan[]>({ path: '/v1/subscriptions/plans' });
  }

  /** Deactivate a plan (existing subscribers remain until cancelled). */
  deactivatePlan(planId: string): Promise<SubscriptionPlan> {
    return this.http.request<SubscriptionPlan>({
      method: 'DELETE',
      path:   `/v1/subscriptions/plans/${planId}`,
    });
  }
}

// packages/sdk/src/AliaSDK.ts
// Main SDK entry-point — instantiate once, share across your application.

import { AliaHttpClient }      from './client';
import { AliasClient }         from './modules/alias';
import { IdentityClient }      from './modules/identity';
import { TrustClient }         from './modules/trust';
import { ConsentClient }       from './modules/consent';
import { RoutingClient }       from './modules/routing';
import { RegistryClient }      from './modules/registry';
import { PartnerClient }       from './modules/partner';
import { PaymentClient }       from './modules/payment';
import { MerchantClient }      from './modules/merchant';
import { SubscriptionClient }  from './modules/subscription';
import type { AliaSDKConfig }  from './types';

/**
 * AliaSDK — the official TypeScript client for the ALIA Financial Identity Network.
 *
 * ALIA is the DNS layer for African payments:
 *   Customer → Email / Phone / Username → ALIA → Existing Institution → Existing Rail
 *
 * Your processor (Paystack, Flutterwave, Squad, etc.) remains the settlement engine.
 * ALIA provides: Identity · Authorization · Consent · Routing · Trust
 *
 * @example Quick start
 * ```ts
 * import { AliaSDK } from '@rald-alia/sdk';
 *
 * const alia = new AliaSDK({ apiKey: process.env.ALIA_API_KEY! });
 *
 * // Resolve an alias to routing metadata
 * const alias = await alia.alias.resolve({ alias: '+2348012345678', country: 'NG' });
 *
 * // Initiate a payment (ALIA provides identity + routing; your processor settles)
 * const payment = await alia.payments.initiate({
 *   source_alias:      '+2348012345678',
 *   destination_alias: 'store@rald',
 *   amount_minor:      15_000_00,
 *   currency:          'NGN',
 *   idempotency_key:   crypto.randomUUID(),
 * });
 * ```
 *
 * @example Bank integration (< 1 week)
 * ```ts
 * const partner = await alia.partner.register({
 *   name: 'GTBank', type: 'bank', country: 'NG',
 *   contact_email: 'integrations@gtbank.com',
 * });
 * ```
 *
 * @example Merchant checkout (< 15 minutes)
 * ```ts
 * const session = await alia.merchant.createCheckout({
 *   amount_minor: 25_000_00, currency: 'NGN',
 *   reference: 'ORDER-4892', redirect_url: 'https://mystore.com/success',
 * });
 * redirect(session.checkout_url);
 * ```
 */
export class AliaSDK {
  // ── Core identity modules ────────────────────────────────────────────────

  /** Alias resolution, creation, and read. Scopes: alias:resolve, alias:create, alias:read. */
  public readonly alias:    AliasClient;

  /** KYC / identity verification. Scope: identity:verify. */
  public readonly identity: IdentityClient;

  /** Trust score reads. Scope: trust:read. */
  public readonly trust:    TrustClient;

  /** Consent request and read. Scopes: consent:grant, consent:read. */
  public readonly consent:  ConsentClient;

  /** Low-level payment routing (internal). Scope: routing:initiate. */
  public readonly routing:  RoutingClient;

  /** Registry record reads (7-dimension entity status). Scope: registry:read. */
  public readonly registry: RegistryClient;

  // ── ALIA Connect (Integration Engine) ────────────────────────────────────

  /**
   * Partner registration and webhook management.
   * For banks, processors, wallets, mobile money, card issuers, governments, merchants.
   * Scopes: partner:register, partner:read, partner:webhooks.
   */
  public readonly partner: PartnerClient;

  /**
   * Consumer payment initiation and verification.
   * ALIA resolves identity + routing; your processor handles settlement.
   * Scopes: payments:initiate, payments:verify, payments:list.
   */
  public readonly payments: PaymentClient;

  /**
   * Merchant registration and ALIA Checkout sessions.
   * Activate ALIA Checkout in < 15 minutes.
   * Scopes: merchant:register, merchant:read, merchant:checkout.
   */
  public readonly merchant: MerchantClient;

  /**
   * Recurring billing via ALIA identity.
   * Customers authorize once; ALIA manages renewal consent.
   * Scopes: subscriptions:create, subscriptions:read, subscriptions:cancel, subscriptions:plans.
   */
  public readonly subscriptions: SubscriptionClient;

  private readonly http: AliaHttpClient;

  constructor(config: AliaSDKConfig) {
    if (!config.apiKey) throw new Error('[AliaSDK] apiKey is required.');

    this.http = new AliaHttpClient({
      apiKey:     config.apiKey,
      baseUrl:    config.baseUrl,
      timeoutMs:  config.timeoutMs,
      maxRetries: config.maxRetries,
      headers:    config.headers,
    });

    // Core
    this.alias         = new AliasClient(this.http);
    this.identity      = new IdentityClient(this.http);
    this.trust         = new TrustClient(this.http);
    this.consent       = new ConsentClient(this.http);
    this.routing       = new RoutingClient(this.http);
    this.registry      = new RegistryClient(this.http);

    // ALIA Connect
    this.partner       = new PartnerClient(this.http);
    this.payments      = new PaymentClient(this.http);
    this.merchant      = new MerchantClient(this.http);
    this.subscriptions = new SubscriptionClient(this.http);
  }
}

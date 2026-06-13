// packages/sdk/src/AliaSDK.ts
// Main SDK entry-point — instantiate once, share across your application.

import { AliaHttpClient }  from './client';
import { AliasClient }     from './modules/alias';
import { IdentityClient }  from './modules/identity';
import { TrustClient }     from './modules/trust';
import { ConsentClient }   from './modules/consent';
import { RoutingClient }   from './modules/routing';
import { RegistryClient }  from './modules/registry';
import type { AliaSDKConfig } from './types';

/**
 * AliaSDK — the official TypeScript client for the ALIA Financial Identity Network.
 *
 * @example
 * ```ts
 * import { AliaSDK } from '@rald-alia/sdk';
 *
 * const alia = new AliaSDK({ apiKey: process.env.ALIA_API_KEY! });
 *
 * // Resolve an alias
 * const alias = await alia.alias.resolve({ alias: '+2348012345678', country: 'NG' });
 *
 * // Initiate a payment
 * const routing = await alia.routing.initiate({
 *   source_alias:      '+2348012345678',
 *   destination_alias: 'user@paystack',
 *   amount_minor:      5000_00,
 *   currency:          'NGN',
 *   idempotency_key:   crypto.randomUUID(),
 * });
 * ```
 */
export class AliaSDK {
  /** Alias resolution, creation, and read. Scopes: alias:resolve, alias:create, alias:read. */
  public readonly alias:    AliasClient;

  /** KYC / identity verification. Scope: identity:verify. */
  public readonly identity: IdentityClient;

  /** Trust score reads. Scope: trust:read. */
  public readonly trust:    TrustClient;

  /** Consent request and read. Scopes: consent:grant, consent:read. */
  public readonly consent:  ConsentClient;

  /** Payment routing initiation and status. Scope: routing:initiate. */
  public readonly routing:  RoutingClient;

  /** Registry record reads (full 7-dimension entity status). Scope: registry:read. */
  public readonly registry: RegistryClient;

  private readonly http: AliaHttpClient;

  constructor(config: AliaSDKConfig) {
    if (!config.apiKey) throw new Error('AliaSDK requires an apiKey');

    this.http = new AliaHttpClient({
      apiKey:     config.apiKey,
      baseUrl:    config.baseUrl,
      timeoutMs:  config.timeoutMs,
      maxRetries: config.maxRetries,
      headers:    config.headers,
    });

    this.alias    = new AliasClient(this.http);
    this.identity = new IdentityClient(this.http);
    this.trust    = new TrustClient(this.http);
    this.consent  = new ConsentClient(this.http);
    this.routing  = new RoutingClient(this.http);
    this.registry = new RegistryClient(this.http);
  }
}

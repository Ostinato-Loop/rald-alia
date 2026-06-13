// packages/sdk/src/modules/alias.ts
import type { AliaHttpClient }                     from '../client';
import type { Alias, CreateAliasParams, ResolveAliasParams } from '../types';

/**
 * AliasClient — resolve, create, and read ALIA aliases.
 *
 * Required scopes:
 *   - alias:resolve  → resolve()
 *   - alias:create   → create()
 *   - alias:read     → get()
 */
export class AliasClient {
  constructor(private readonly http: AliaHttpClient) {}

  /**
   * Resolve a raw alias value to routing metadata.
   * @example
   *   const alias = await sdk.alias.resolve({ alias: '+2348012345678', country: 'NG' });
   */
  resolve(params: ResolveAliasParams): Promise<Alias> {
    return this.http.request<Alias>({
      method: 'POST',
      path:   '/v1/aliases/resolve',
      body:   params,
    });
  }

  /**
   * Register a new alias and bind it to routing metadata.
   * Subject to country compliance checks — the country must be operational.
   */
  create(params: CreateAliasParams): Promise<Alias> {
    return this.http.request<Alias>({
      method: 'POST',
      path:   '/v1/aliases',
      body:   params,
    });
  }

  /**
   * Fetch an alias by its internal ALIA ID.
   */
  get(aliasId: string): Promise<Alias> {
    return this.http.request<Alias>({ path: `/v1/aliases/${aliasId}` });
  }
}

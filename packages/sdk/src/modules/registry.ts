// packages/sdk/src/modules/registry.ts
import type { AliaHttpClient }  from '../client';
import type { RegistryRecord }  from '../types';

/**
 * RegistryClient — read ALIA registry records (full entity status across all dimensions).
 *
 * Required scope: registry:read
 */
export class RegistryClient {
  constructor(private readonly http: AliaHttpClient) {}

  /**
   * Fetch the full 7-dimension registry record for an entity.
   */
  get(entityId: string): Promise<RegistryRecord> {
    return this.http.request<RegistryRecord>({ path: `/v1/registry/${entityId}` });
  }

  /**
   * Look up a registry record by alias (rather than entity ID).
   */
  getByAlias(alias: string, country: string): Promise<RegistryRecord> {
    return this.http.request<RegistryRecord>({
      path:  '/v1/registry/by-alias',
      query: { alias, country },
    });
  }
}

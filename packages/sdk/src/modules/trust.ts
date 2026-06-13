// packages/sdk/src/modules/trust.ts
import type { AliaHttpClient } from '../client';
import type { TrustScore }     from '../types';

/**
 * TrustClient — read trust scores for ALIA entities.
 *
 * Required scope: trust:read
 */
export class TrustClient {
  constructor(private readonly http: AliaHttpClient) {}

  /**
   * Fetch the current trust score for an entity.
   */
  getScore(entityId: string): Promise<TrustScore> {
    return this.http.request<TrustScore>({ path: `/v1/trust/${entityId}` });
  }

  /**
   * List entities by trust tier.
   */
  listByTier(tier: 'low' | 'medium' | 'high' | 'premium', country?: string): Promise<TrustScore[]> {
    return this.http.request<TrustScore[]>({
      path:  '/v1/trust',
      query: { tier, country },
    });
  }
}

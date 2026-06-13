// packages/sdk/src/modules/routing.ts
import type { AliaHttpClient }                           from '../client';
import type { RoutingRequest, InitiateRoutingParams }     from '../types';

/**
 * RoutingClient — initiate and track payment routing requests.
 *
 * Required scope: routing:initiate
 */
export class RoutingClient {
  constructor(private readonly http: AliaHttpClient) {}

  /**
   * Initiate a payment routing request between two ALIA aliases.
   * Idempotent — supply the same idempotency_key to safely retry without
   * duplicate payments.
   */
  initiate(params: InitiateRoutingParams): Promise<RoutingRequest> {
    return this.http.request<RoutingRequest>({
      method: 'POST',
      path:   '/v1/routing',
      body:   params,
    });
  }

  /**
   * Fetch the current status of a routing request.
   */
  get(routingId: string): Promise<RoutingRequest> {
    return this.http.request<RoutingRequest>({ path: `/v1/routing/${routingId}` });
  }
}

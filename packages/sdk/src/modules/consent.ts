// packages/sdk/src/modules/consent.ts
import type { AliaHttpClient }             from '../client';
import type { Consent, GrantConsentParams } from '../types';

/**
 * ConsentClient — request and read user consents.
 *
 * Required scopes:
 *   - consent:grant  → grant()
 *   - consent:read   → get(), list()
 */
export class ConsentClient {
  constructor(private readonly http: AliaHttpClient) {}

  /**
   * Request consent from a subject on behalf of your application.
   * Returns immediately with PENDING status; consent is async (user action required).
   */
  grant(params: GrantConsentParams): Promise<Consent> {
    return this.http.request<Consent>({
      method: 'POST',
      path:   '/v1/consents',
      body:   params,
    });
  }

  /**
   * Fetch a consent record by ID.
   */
  get(consentId: string): Promise<Consent> {
    return this.http.request<Consent>({ path: `/v1/consents/${consentId}` });
  }

  /**
   * List all active consents for a subject.
   */
  list(subjectId: string): Promise<Consent[]> {
    return this.http.request<Consent[]>({ path: `/v1/consents/subject/${subjectId}` });
  }
}

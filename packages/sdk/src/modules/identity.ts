// packages/sdk/src/modules/identity.ts
import type { AliaHttpClient }                              from '../client';
import type { IdentityVerification, VerifyIdentityParams }  from '../types';

/**
 * IdentityClient — KYC / identity verification.
 *
 * Required scope: identity:verify
 */
export class IdentityClient {
  constructor(private readonly http: AliaHttpClient) {}

  /**
   * Submit a KYC document for identity verification.
   * Returns immediately with a PENDING record; the verification is async.
   */
  verify(params: VerifyIdentityParams): Promise<IdentityVerification> {
    return this.http.request<IdentityVerification>({
      method: 'POST',
      path:   '/v1/identity/verify',
      body:   params,
    });
  }

  /**
   * Poll the status of an in-progress verification.
   */
  get(verificationId: string): Promise<IdentityVerification> {
    return this.http.request<IdentityVerification>({ path: `/v1/identity/${verificationId}` });
  }

  /**
   * List all verifications for a subject.
   */
  list(subjectId: string): Promise<IdentityVerification[]> {
    return this.http.request<IdentityVerification[]>({ path: `/v1/identity/subject/${subjectId}` });
  }
}

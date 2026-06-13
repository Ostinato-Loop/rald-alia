import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { logger } from '../index';
import { ConsentRepository } from '../repositories/consent.repository';

export interface Consent {
  id: string;
  subject_id: string;
  subject_type: string;
  grantee_id: string;
  grantee_type: string;
  scope: string[];
  purpose: string;
  data_classes: string[];
  status: 'active' | 'revoked' | 'expired';
  signature: string;
  version: number;
  granted_at: string;
  expires_at?: string;
  revoked_at?: string;
  revocation_reason?: string;
  revoked_by?: string;
  conditions?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

export interface ConsentAuditEntry {
  id: string;
  consent_id: string;
  event: string;
  actor_id?: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

function rowToConsent(row: Record<string, unknown>): Consent {
  return {
    id:                row['id'] as string,
    subject_id:        row['subjectId'] as string,
    subject_type:      row['subjectType'] as string,
    grantee_id:        row['granteeId'] as string,
    grantee_type:      row['granteeType'] as string,
    scope:             row['scope'] as string[],
    purpose:           row['purpose'] as string,
    data_classes:      row['dataClasses'] as string[],
    status:            row['status'] as Consent['status'],
    signature:         row['signature'] as string,
    version:           row['version'] as number,
    granted_at:        (row['grantedAt'] as Date).toISOString(),
    expires_at:        row['expiresAt'] ? (row['expiresAt'] as Date).toISOString() : undefined,
    revoked_at:        row['revokedAt'] ? (row['revokedAt'] as Date).toISOString() : undefined,
    revocation_reason: row['revocationReason'] as string | undefined,
    revoked_by:        row['revokedBy'] as string | undefined,
    conditions:        row['conditions'] as Record<string, unknown> | undefined,
    ip_address:        row['ipAddress'] as string | undefined,
    user_agent:        row['userAgent'] as string | undefined,
  };
}

function signConsent(c: { subject_id: string; grantee_id: string; scope: string[]; purpose: string }): string {
  const payload = JSON.stringify({
    subject_id: c.subject_id,
    grantee_id: c.grantee_id,
    scope:      [...c.scope].sort(),
    purpose:    c.purpose,
    timestamp:  new Date().toISOString(),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export class ConsentEngine {
  private repo = new ConsentRepository();

  async grantConsent(data: Omit<Consent, 'id' | 'signature' | 'version' | 'granted_at' | 'status'> & { duration_days?: number }): Promise<Consent> {
    const existing = await this.repo.findActiveConsent(data.subject_id, data.grantee_id, data.scope);

    if (existing) {
      const updated = await this.repo.updateConsent(existing.id, {
        purpose:    data.purpose,
        dataClasses: data.data_classes,
        conditions: data.conditions ?? null,
        version:    existing.version + 1,
        expiresAt:  data.duration_days ? new Date(Date.now() + data.duration_days * 86_400_000) : undefined,
      });
      await this.repo.insertAuditEntry({ consentId: existing.id, event: 'consent.updated', metadata: { version: existing.version + 1 } });
      return rowToConsent(updated as Record<string, unknown>);
    }

    const signature = signConsent(data);
    const row = await this.repo.insertConsent({
      id:          uuidv4(),
      subjectId:   data.subject_id,
      subjectType: data.subject_type,
      granteeId:   data.grantee_id,
      granteeType: data.grantee_type,
      scope:       data.scope,
      purpose:     data.purpose,
      dataClasses: data.data_classes,
      status:      'active',
      signature,
      version:     1,
      conditions:  data.conditions ?? null,
      ipAddress:   data.ip_address ?? null,
      userAgent:   data.user_agent ?? null,
      expiresAt:   data.duration_days ? new Date(Date.now() + data.duration_days * 86_400_000) : null,
    });

    await this.repo.insertAuditEntry({ consentId: row.id, event: 'consent.granted', metadata: { scope: data.scope, purpose: data.purpose } });
    logger.info('Consent granted', { id: row.id, subject: data.subject_id, grantee: data.grantee_id });
    return rowToConsent(row as unknown as Record<string, unknown>);
  }

  async revokeConsent(consentId: string, reason: string, revokedBy?: string): Promise<Consent> {
    const row = await this.repo.findConsentById(consentId);
    if (!row) throw new Error(`Consent ${consentId} not found`);
    if (row.status !== 'active') throw new Error(`Cannot revoke consent with status: ${row.status}`);

    const updated = await this.repo.updateConsent(consentId, {
      status:           'revoked',
      revokedAt:        new Date(),
      revocationReason: reason,
      revokedBy:        revokedBy ?? null,
    });
    await this.repo.insertAuditEntry({ consentId, event: 'consent.revoked', actorId: revokedBy, metadata: { reason } });
    logger.info('Consent revoked', { id: consentId, reason });
    return rowToConsent(updated as unknown as Record<string, unknown>);
  }

  async verifyConsent(subjectId: string, granteeId: string, requiredScope: string): Promise<{ valid: boolean; consent?: Consent; reason?: string }> {
    const rows = await this.repo.listConsents({ subjectId, granteeId, status: 'active', page: 1, limit: 100 });

    for (const row of rows) {
      const scope = row.scope as string[];
      if (!scope.includes(requiredScope)) continue;

      if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
        await this.repo.updateConsent(row.id, { status: 'expired' });
        continue;
      }
      return { valid: true, consent: rowToConsent(row as unknown as Record<string, unknown>) };
    }
    return { valid: false, reason: 'No active consent found for required scope' };
  }

  async getConsent(consentId: string): Promise<Consent | null> {
    const row = await this.repo.findConsentById(consentId);
    return row ? rowToConsent(row as unknown as Record<string, unknown>) : null;
  }

  async listConsents(subjectId: string, page = 1, limit = 20): Promise<{ consents: Consent[]; total: number }> {
    const rows = await this.repo.listConsents({ subjectId, page, limit });
    return { consents: rows.map((r) => rowToConsent(r as unknown as Record<string, unknown>)), total: rows.length };
  }

  async getAuditTrail(consentId: string): Promise<ConsentAuditEntry[]> {
    const rows = await this.repo.getAuditTrail(consentId);
    return rows.map((r) => ({
      id:         r.id,
      consent_id: r.consentId,
      event:      r.event,
      actor_id:   r.actorId ?? undefined,
      metadata:   r.metadata as Record<string, unknown>,
      timestamp:  r.createdAt.toISOString(),
    }));
  }
}

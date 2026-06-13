import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { logger } from '../index';
import { KycRepository } from '../repositories/kyc.repository';

export interface KYCDocument {
  type:       string;
  number?:    string;
  hash?:      string;
  file_url?:  string;
  country:    string;
  verified:   boolean;
  expires_at?: string;
}

export interface KYCSession {
  id:                     string;
  entity_id:              string;
  entity_type:            string;
  country:                string;
  tier:                   string;
  documents:              KYCDocument[];
  provider:               string;
  status:                 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  rejection_reason?:      string;
  review_notes?:          string;
  reviewed_by?:           string;
  reviewed_at?:           string;
  callback_url?:          string;
  verification_reference: string;
  expires_at:             string;
  created_at:             string;
  updated_at:             string;
}

export interface VerificationCredential {
  entity_id:   string;
  entity_type: string;
  credential_type: string;
  issuer:      string;
  issued_at:   string;
  expires_at?: string;
  attributes:  Record<string, unknown>;
}

// KYC tier requirements per country
const TIER_REQUIREMENTS: Record<string, Record<string, string[]>> = {
  NG: {
    tier1: ['phone'],
    tier2: ['bvn'],
    tier3: ['bvn', 'nin', 'passport_or_drivers_license'],
  },
  GH: {
    tier1: ['phone'],
    tier2: ['ghana_card'],
    tier3: ['ghana_card', 'utility_bill'],
  },
  KE: {
    tier1: ['phone'],
    tier2: ['national_id'],
    tier3: ['national_id', 'kra_pin'],
  },
  DEFAULT: {
    tier1: ['phone'],
    tier2: ['national_id'],
    tier3: ['national_id', 'proof_of_address'],
  },
};

function rowToSession(r: Record<string, unknown>): KYCSession {
  return {
    id:                     r['id'] as string,
    entity_id:              r['entityId'] as string,
    entity_type:            r['entityType'] as string,
    country:                r['country'] as string,
    tier:                   r['tier'] as string,
    documents:              r['documents'] as KYCDocument[],
    provider:               r['provider'] as string,
    status:                 r['status'] as KYCSession['status'],
    rejection_reason:       r['rejectionReason'] as string | undefined,
    review_notes:           r['reviewNotes'] as string | undefined,
    reviewed_by:            r['reviewedBy'] as string | undefined,
    reviewed_at:            r['reviewedAt'] ? (r['reviewedAt'] as Date).toISOString() : undefined,
    callback_url:           r['callbackUrl'] as string | undefined,
    verification_reference: r['verificationReference'] as string,
    expires_at:             (r['expiresAt'] as Date).toISOString(),
    created_at:             (r['createdAt'] as Date).toISOString(),
    updated_at:             (r['updatedAt'] as Date).toISOString(),
  };
}

export class KYCEngine {
  private repo = new KycRepository();

  async initiateKYC(data: {
    entity_id:   string;
    entity_type: string;
    country:     string;
    tier:        string;
    documents:   KYCDocument[];
    provider?:   string;
    callback_url?: string;
  }): Promise<KYCSession> {
    const reference = createHash('sha256')
      .update(`${data.entity_id}:${data.tier}:${Date.now()}`)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const row = await this.repo.insert({
      id:                    uuidv4(),
      entityId:              data.entity_id,
      entityType:            data.entity_type,
      country:               data.country,
      tier:                  data.tier,
      documents:             data.documents,
      provider:              data.provider ?? 'internal',
      status:                'pending',
      verificationReference: reference,
      callbackUrl:           data.callback_url ?? null,
      expiresAt,
    });

    logger.info('KYC session initiated', { id: row.id, entityId: data.entity_id, tier: data.tier });
    return rowToSession(row as unknown as Record<string, unknown>);
  }

  async getSession(sessionId: string): Promise<KYCSession | null> {
    const row = await this.repo.findById(sessionId);
    return row ? rowToSession(row as unknown as Record<string, unknown>) : null;
  }

  async getLatestSession(entityId: string, entityType: string): Promise<KYCSession | null> {
    const row = await this.repo.findLatestByEntity(entityId, entityType);
    return row ? rowToSession(row as unknown as Record<string, unknown>) : null;
  }

  async getSessionHistory(entityId: string, entityType: string): Promise<KYCSession[]> {
    const rows = await this.repo.listByEntity(entityId, entityType);
    return rows.map((r) => rowToSession(r as unknown as Record<string, unknown>));
  }

  async reviewSession(sessionId: string, decision: {
    status:       'approved' | 'rejected';
    reviewed_by:  string;
    review_notes?: string;
    rejection_reason?: string;
  }): Promise<KYCSession> {
    const row = await this.repo.findById(sessionId);
    if (!row) throw new Error(`KYC session ${sessionId} not found`);
    if (row.status !== 'pending' && row.status !== 'in_review') {
      throw new Error(`Cannot review session with status: ${row.status}`);
    }

    const updated = await this.repo.update(sessionId, {
      status:          decision.status,
      reviewedBy:      decision.reviewed_by,
      reviewedAt:      new Date(),
      reviewNotes:     decision.review_notes ?? null,
      rejectionReason: decision.rejection_reason ?? null,
    });

    logger.info('KYC session reviewed', { sessionId, decision: decision.status, reviewedBy: decision.reviewed_by });
    return rowToSession(updated as unknown as Record<string, unknown>);
  }

  async getRequirements(country: string, tier: string): Promise<{
    required_documents: string[];
    optional_documents: string[];
    notes:              string;
  }> {
    const countryReqs = TIER_REQUIREMENTS[country] ?? TIER_REQUIREMENTS['DEFAULT']!;
    const required    = countryReqs[tier] ?? [];
    return {
      required_documents: required,
      optional_documents: ['selfie', 'liveness_check'],
      notes:              `${tier} verification for ${country}. Documents must be valid and not expired.`,
    };
  }

  async verifyDocument(doc: KYCDocument): Promise<{ verified: boolean; confidence: number; reason?: string }> {
    // Stub: production delegates to Smile ID, Jumio, or equiv.
    if (!doc.number && !doc.hash) {
      return { verified: false, confidence: 0, reason: 'No document number or hash provided' };
    }
    logger.info('Document verification requested', { type: doc.type, country: doc.country });
    return { verified: true, confidence: 0.85 };
  }
}

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../index';
import { MerchantRepository } from '../repositories/merchant.repository';

export interface Merchant {
  id:                           string;
  name:                         string;
  handle:                       string;
  owner_id:                     string;
  owner_type:                   string;
  category:                     string;
  country:                      string;
  business_registration_number?: string;
  tax_identification_number?:   string;
  contact_email:                string;
  contact_phone:                string;
  website?:                     string;
  description?:                 string;
  bank_alias?:                  string;
  status:                       'pending' | 'active' | 'suspended' | 'terminated';
  verified:                     boolean;
  verified_at?:                 string;
  verified_by?:                 string;
  verification_notes?:          string;
  trust_score:                  number;
  suspension_reason?:           string;
  suspended_at?:                string;
  suspended_by?:                string;
  metadata?:                    Record<string, unknown>;
  created_at:                   string;
  updated_at:                   string;
}

function rowToMerchant(r: Record<string, unknown>): Merchant {
  return {
    id:                           r['id'] as string,
    name:                         r['name'] as string,
    handle:                       r['handle'] as string,
    owner_id:                     r['ownerId'] as string,
    owner_type:                   r['ownerType'] as string,
    category:                     r['category'] as string,
    country:                      r['country'] as string,
    business_registration_number: r['businessRegistrationNumber'] as string | undefined,
    tax_identification_number:    r['taxIdentificationNumber'] as string | undefined,
    contact_email:                r['contactEmail'] as string,
    contact_phone:                r['contactPhone'] as string,
    website:                      r['website'] as string | undefined,
    description:                  r['description'] as string | undefined,
    bank_alias:                   r['bankAlias'] as string | undefined,
    status:                       r['status'] as Merchant['status'],
    verified:                     r['verified'] as boolean,
    verified_at:                  r['verifiedAt'] ? (r['verifiedAt'] as Date).toISOString() : undefined,
    verified_by:                  r['verifiedBy'] as string | undefined,
    verification_notes:           r['verificationNotes'] as string | undefined,
    trust_score:                  r['trustScore'] as number,
    suspension_reason:            r['suspensionReason'] as string | undefined,
    suspended_at:                 r['suspendedAt'] ? (r['suspendedAt'] as Date).toISOString() : undefined,
    suspended_by:                 r['suspendedBy'] as string | undefined,
    metadata:                     r['metadata'] as Record<string, unknown> | undefined,
    created_at:                   (r['createdAt'] as Date).toISOString(),
    updated_at:                   (r['updatedAt'] as Date).toISOString(),
  };
}

export class MerchantEngine {
  private repo = new MerchantRepository();

  async createMerchant(data: Omit<Merchant, 'id' | 'status' | 'verified' | 'trust_score' | 'created_at' | 'updated_at'>): Promise<Merchant> {
    const exists = await this.repo.handleExists(data.handle);
    if (exists) throw new Error(`Merchant handle '${data.handle}' already taken`);

    const row = await this.repo.insert({
      id:                         uuidv4(),
      name:                       data.name,
      handle:                     data.handle,
      ownerId:                    data.owner_id,
      ownerType:                  data.owner_type,
      category:                   data.category,
      country:                    data.country,
      businessRegistrationNumber: data.business_registration_number ?? null,
      taxIdentificationNumber:    data.tax_identification_number ?? null,
      contactEmail:               data.contact_email,
      contactPhone:               data.contact_phone,
      website:                    data.website ?? null,
      description:                data.description ?? null,
      bankAlias:                  data.bank_alias ?? null,
      status:                     'pending',
      verified:                   false,
      trustScore:                 30,
      metadata:                   data.metadata ?? null,
    });

    logger.info('Merchant created', { id: row.id, handle: row.handle });
    return rowToMerchant(row as unknown as Record<string, unknown>);
  }

  async getMerchant(id: string): Promise<Merchant | null> {
    const row = await this.repo.findById(id);
    return row ? rowToMerchant(row as unknown as Record<string, unknown>) : null;
  }

  async getMerchantByHandle(handle: string): Promise<Merchant | null> {
    const row = await this.repo.findByHandle(handle);
    return row ? rowToMerchant(row as unknown as Record<string, unknown>) : null;
  }

  async listMerchants(opts: {
    owner_id?: string;
    category?: string;
    country?:  string;
    status?:   string;
    page?:     number;
    limit?:    number;
  }): Promise<{ merchants: Merchant[]; total: number }> {
    const { data, total } = await this.repo.list({
      ownerId:  opts.owner_id,
      category: opts.category,
      country:  opts.country,
      status:   opts.status,
      page:     opts.page ?? 1,
      limit:    opts.limit ?? 20,
    });
    return { merchants: data.map((r) => rowToMerchant(r as unknown as Record<string, unknown>)), total };
  }

  async verifyMerchant(id: string, verifiedBy: string, notes?: string): Promise<Merchant> {
    const row = await this.repo.findById(id);
    if (!row) throw new Error(`Merchant ${id} not found`);
    if (row.status !== 'pending' && row.status !== 'active') throw new Error(`Cannot verify merchant with status: ${row.status}`);

    const updated = await this.repo.update(id, {
      status:            'active',
      verified:          true,
      verifiedAt:        new Date(),
      verifiedBy,
      verificationNotes: notes ?? null,
    });
    logger.info('Merchant verified', { id, verifiedBy });
    return rowToMerchant(updated as unknown as Record<string, unknown>);
  }

  async suspendMerchant(id: string, reason: string, suspendedBy: string): Promise<Merchant> {
    const row = await this.repo.findById(id);
    if (!row) throw new Error(`Merchant ${id} not found`);

    const updated = await this.repo.update(id, {
      status:           'suspended',
      suspensionReason: reason,
      suspendedAt:      new Date(),
      suspendedBy,
    });
    logger.warn('Merchant suspended', { id, reason });
    return rowToMerchant(updated as unknown as Record<string, unknown>);
  }

  async reinstateMerchant(id: string): Promise<Merchant> {
    const row = await this.repo.findById(id);
    if (!row) throw new Error(`Merchant ${id} not found`);

    const updated = await this.repo.update(id, {
      status:           'active',
      suspensionReason: null,
      suspendedAt:      null,
      suspendedBy:      null,
    });
    logger.info('Merchant reinstated', { id });
    return rowToMerchant(updated as unknown as Record<string, unknown>);
  }

  async updateTrustScore(id: string, score: number): Promise<void> {
    await this.repo.update(id, { trustScore: Math.min(100, Math.max(0, score)) });
  }
}

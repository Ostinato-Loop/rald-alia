// services/control-plane/src/services/developerQueue.ts
// Admin queue for reviewing and approving developer applications.
// Reads directly from the DB; proxies status transitions to developer-service.

import { eq, and, desc } from 'drizzle-orm';
import { getDb, developers } from '@rald-alia/db';
import { logger } from '../index';

export interface DeveloperQueueItem {
  id:          string;
  name:        string;
  email:       string;
  country:     string;
  status:      string;
  website?:    string;
  kyc_verified: boolean;
  applied_at:  string;
  updated_at:  string;
}

export interface QueueStats {
  total_applied:   number;
  total_verified:  number;
  total_active:    number;
  total_suspended: number;
  total_revoked:   number;
}

const DEVELOPER_SERVICE_URL = () => process.env['DEVELOPER_SERVICE_URL'] ?? 'http://developer-service:3009';
const MACHINE_TOKEN         = () => process.env['CONTROL_PLANE_MACHINE_TOKEN'] ?? '';

export class DeveloperQueueService {
  private db = getDb();

  async listQueue(opts: {
    status?: string;
    country?: string;
    page: number;
    limit: number;
  }): Promise<{ items: DeveloperQueueItem[]; total: number }> {
    const conditions: any[] = [];
    if (opts.status)  conditions.push(eq(developers.status, opts.status as any));
    if (opts.country) conditions.push(eq(developers.country, opts.country));

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, all] = await Promise.all([
      this.db.select().from(developers).where(where).orderBy(desc(developers.createdAt)).limit(opts.limit).offset((opts.page - 1) * opts.limit),
      this.db.select({ id: developers.id }).from(developers).where(where),
    ]);

    return {
      items: rows.map((r) => ({
        id:           r.id,
        name:         r.name,
        email:        r.email,
        country:      r.country,
        status:       r.status,
        website:      r.website ?? undefined,
        kyc_verified: r.kycVerified,
        applied_at:   r.createdAt.toISOString(),
        updated_at:   r.updatedAt.toISOString(),
      })),
      total: all.length,
    };
  }

  async getStats(): Promise<QueueStats> {
    const all = await this.db.select({ id: developers.id, status: developers.status }).from(developers);
    return {
      total_applied:   all.filter((r) => r.status === 'applied').length,
      total_verified:  all.filter((r) => r.status === 'verified').length,
      total_active:    all.filter((r) => r.status === 'active').length,
      total_suspended: all.filter((r) => r.status === 'suspended').length,
      total_revoked:   all.filter((r) => r.status === 'revoked').length,
    };
  }

  async approve(developerId: string, actorId: string): Promise<{ success: boolean; status: string }> {
    return this.transition(developerId, 'verified', actorId);
  }

  async activate(developerId: string, actorId: string): Promise<{ success: boolean; status: string }> {
    return this.transition(developerId, 'active', actorId);
  }

  async suspend(developerId: string, actorId: string, reason: string): Promise<{ success: boolean; status: string }> {
    return this.transition(developerId, 'suspended', actorId, reason);
  }

  async revoke(developerId: string, actorId: string, reason: string): Promise<{ success: boolean; status: string }> {
    return this.transition(developerId, 'revoked', actorId, reason);
  }

  private async transition(developerId: string, toStatus: string, actorId: string, reason?: string): Promise<{ success: boolean; status: string }> {
    const url = `${DEVELOPER_SERVICE_URL()}/v1/developers/${developerId}/status`;
    logger.info({ developerId, toStatus, actorId }, 'Control-plane transitioning developer status');

    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${MACHINE_TOKEN()}`,
      },
      body: JSON.stringify({
        to_status:  toStatus,
        actor_id:   actorId,
        actor_type: 'control_plane',
        reason,
      }),
    });

    const body = await res.json() as { success: boolean; data?: { status: string }; error?: any };
    if (!res.ok || !body.success) {
      throw Object.assign(
        new Error(body.error?.message ?? 'Developer service returned an error'),
        { status: res.status, code: body.error?.code ?? 'UPSTREAM_ERROR' },
      );
    }

    return { success: true, status: body.data!.status };
  }
}

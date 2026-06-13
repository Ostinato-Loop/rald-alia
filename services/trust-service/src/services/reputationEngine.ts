import { v4 as uuidv4 } from 'uuid';
import { logger } from '../index';
import { TrustRepository } from '../repositories/trust.repository';

export interface ReputationProfile {
  id:                    string;
  entity_id:             string;
  entity_type:           string;
  reputation_score:      number;
  flags:                 ReputationFlag[];
  sanctions_match:       boolean;
  pep_match:             boolean;
  adverse_media:         boolean;
  participation_history: ParticipationHistory;
  created_at:            string;
  updated_at:            string;
}

export interface ReputationFlag {
  type:        string;
  severity:    'low' | 'medium' | 'high' | 'critical';
  description: string;
  raised_at:   string;
  resolved_at?: string;
}

export interface ParticipationHistory {
  total_transactions:      number;
  successful_transactions: number;
  failed_transactions:     number;
  dispute_count:           number;
  avg_transaction_value:   number;
  active_since?:           string;
}

export class ReputationEngine {
  private repo = new TrustRepository();

  async getReputation(entityId: string, entityType: string): Promise<ReputationProfile> {
    const existing = await this.repo.findReputation(entityId, entityType);
    if (existing) return this.rowToProfile(existing);

    // Bootstrap new profile
    const row = await this.repo.upsertReputation({
      id:                   uuidv4(),
      entityId,
      entityType,
      reputationScore:      50,
      flags:                [],
      sanctionsMatch:       false,
      pepMatch:             false,
      adverseMedia:         false,
      participationHistory: { total_transactions: 0, successful_transactions: 0, failed_transactions: 0, dispute_count: 0, avg_transaction_value: 0 },
    });
    return this.rowToProfile(row);
  }

  async addFlag(entityId: string, entityType: string, flag: Omit<ReputationFlag, 'raised_at'>): Promise<ReputationProfile> {
    const existing = await this.repo.findReputation(entityId, entityType);
    const current  = existing ? (existing.flags as ReputationFlag[]) : [];
    const flags    = [...current, { ...flag, raised_at: new Date().toISOString() }];

    const severityImpact: Record<string, number> = { critical: -30, high: -20, medium: -10, low: -5 };
    const newScore = Math.max(0, (existing?.reputationScore ?? 50) + (severityImpact[flag.severity] ?? 0));

    const row = await this.repo.upsertReputation({
      id:                   existing?.id ?? uuidv4(),
      entityId,
      entityType,
      reputationScore:      newScore,
      flags,
      sanctionsMatch:       existing?.sanctionsMatch ?? false,
      pepMatch:             existing?.pepMatch ?? false,
      adverseMedia:         flag.type === 'adverse_media' ? true : (existing?.adverseMedia ?? false),
      participationHistory: existing?.participationHistory ?? {},
    });

    logger.warn('Reputation flag added', { entityId, type: flag.type, severity: flag.severity });
    return this.rowToProfile(row);
  }

  async screenSanctions(entityId: string, entityType: string, _externalResult: { matched: boolean; isPep: boolean }): Promise<ReputationProfile> {
    const existing = await this.repo.findReputation(entityId, entityType);
    let score = existing?.reputationScore ?? 50;
    if (_externalResult.matched) score = Math.max(0, score - 50);
    if (_externalResult.isPep)   score = Math.max(0, score - 20);

    const row = await this.repo.upsertReputation({
      id:                   existing?.id ?? uuidv4(),
      entityId,
      entityType,
      reputationScore:      score,
      flags:                existing?.flags ?? [],
      sanctionsMatch:       _externalResult.matched,
      pepMatch:             _externalResult.isPep,
      adverseMedia:         existing?.adverseMedia ?? false,
      participationHistory: existing?.participationHistory ?? {},
    });

    logger.info('Sanctions screen complete', { entityId, matched: _externalResult.matched, isPep: _externalResult.isPep });
    return this.rowToProfile(row);
  }

  async updateParticipation(
    entityId:   string,
    entityType: string,
    event:      'success' | 'failure' | 'dispute',
    amount?:    number,
  ): Promise<void> {
    const existing = await this.repo.findReputation(entityId, entityType);
    const hist = (existing?.participationHistory as ParticipationHistory) ?? {
      total_transactions: 0, successful_transactions: 0, failed_transactions: 0,
      dispute_count: 0, avg_transaction_value: 0,
    };

    hist.total_transactions += 1;
    if (event === 'success') { hist.successful_transactions += 1; if (!hist.active_since) hist.active_since = new Date().toISOString(); }
    if (event === 'failure') hist.failed_transactions += 1;
    if (event === 'dispute') hist.dispute_count += 1;
    if (amount) hist.avg_transaction_value = Math.round(((hist.avg_transaction_value * (hist.total_transactions - 1)) + amount) / hist.total_transactions);

    await this.repo.upsertReputation({
      id:                   existing?.id ?? uuidv4(),
      entityId,
      entityType,
      reputationScore:      existing?.reputationScore ?? 50,
      flags:                existing?.flags ?? [],
      sanctionsMatch:       existing?.sanctionsMatch ?? false,
      pepMatch:             existing?.pepMatch ?? false,
      adverseMedia:         existing?.adverseMedia ?? false,
      participationHistory: hist,
    });
  }

  private rowToProfile(row: Record<string, unknown>): ReputationProfile {
    return {
      id:                    row['id'] as string,
      entity_id:             row['entityId'] as string,
      entity_type:           row['entityType'] as string,
      reputation_score:      row['reputationScore'] as number,
      flags:                 row['flags'] as ReputationFlag[],
      sanctions_match:       row['sanctionsMatch'] as boolean,
      pep_match:             row['pepMatch'] as boolean,
      adverse_media:         row['adverseMedia'] as boolean,
      participation_history: row['participationHistory'] as ParticipationHistory,
      created_at:            (row['createdAt'] as Date).toISOString(),
      updated_at:            (row['updatedAt'] as Date).toISOString(),
    };
  }
}

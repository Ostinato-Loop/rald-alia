import { v4 as uuidv4 } from 'uuid';
import { logger } from '../index';
import { TrustRepository } from '../repositories/trust.repository';

export interface TrustScore {
  entity_id:            string;
  entity_type:          string;
  overall_score:        number;
  components:           TrustComponent[];
  tier:                 'unverified' | 'basic' | 'standard' | 'trusted' | 'elite';
  risk_level:           'critical' | 'high' | 'medium' | 'low' | 'minimal';
  fraud_score:          number;
  last_recalculated_at: string;
  signals_count:        number;
  created_at:           string;
}

export interface TrustComponent {
  name:         string;
  score:        number;
  weight:       number;
  last_updated: string;
}

export interface TrustSignal {
  id:          string;
  entity_id:   string;
  entity_type: string;
  signal_type: string;
  value:       number;
  source:      string;
  metadata?:   Record<string, unknown>;
  applied_at:  string;
}

export interface TrustHistoryEntry {
  timestamp: string;
  score:     number;
  event:     string;
  delta:     number;
}

const SIGNAL_WEIGHTS: Record<string, number> = {
  verification_completed: 15,
  verification_failed:    -10,
  transaction_success:    2,
  transaction_failed:     -3,
  fraud_flagged:          -30,
  dispute_raised:         -5,
  dispute_resolved:       5,
  kyc_upgrade:            20,
  merchant_verified:      20,
  document_verified:      10,
  behaviour_anomaly:      -15,
  consent_granted:        2,
  login_success:          1,
  login_failed:           -2,
};

function scoreToTier(score: number): TrustScore['tier'] {
  if (score >= 90) return 'elite';
  if (score >= 75) return 'trusted';
  if (score >= 55) return 'standard';
  if (score >= 35) return 'basic';
  return 'unverified';
}

function scoreToRisk(score: number): TrustScore['risk_level'] {
  if (score >= 80) return 'minimal';
  if (score >= 65) return 'low';
  if (score >= 45) return 'medium';
  if (score >= 25) return 'high';
  return 'critical';
}

export class TrustScoreEngine {
  private repo = new TrustRepository();

  async addSignal(data: {
    entity_id:   string;
    entity_type: string;
    signal_type: string;
    value?:      number;
    source:      string;
    metadata?:   Record<string, unknown>;
  }): Promise<TrustScore> {
    const weight = SIGNAL_WEIGHTS[data.signal_type] ?? 0;
    const signalValue = data.value ?? weight;

    await this.repo.insertSignal({
      entityId:   data.entity_id,
      entityType: data.entity_type,
      signalType: data.signal_type,
      value:      signalValue,
      source:     data.source,
      metadata:   data.metadata,
    });

    return this.recalculate(data.entity_id, data.entity_type, data.signal_type);
  }

  async getScore(entityId: string, entityType: string): Promise<TrustScore> {
    const row = await this.repo.findTrustScore(entityId, entityType);
    if (row) {
      return {
        entity_id:            row.entityId,
        entity_type:          row.entityType,
        overall_score:        row.overallScore,
        components:           row.components as TrustComponent[],
        tier:                 row.tier as TrustScore['tier'],
        risk_level:           row.riskLevel as TrustScore['risk_level'],
        fraud_score:          row.fraudScore,
        signals_count:        row.signalsCount,
        last_recalculated_at: row.lastRecalculatedAt.toISOString(),
        created_at:           row.createdAt.toISOString(),
      };
    }
    // Bootstrap new entity score
    return this.recalculate(entityId, entityType, 'initial');
  }

  async getSignals(entityId: string): Promise<TrustSignal[]> {
    const rows = await this.repo.getSignals(entityId);
    return rows.map((r) => ({
      id:          r.id,
      entity_id:   r.entityId,
      entity_type: r.entityType,
      signal_type: r.signalType,
      value:       Number(r.value),
      source:      r.source,
      metadata:    r.metadata as Record<string, unknown> | undefined,
      applied_at:  r.appliedAt.toISOString(),
    }));
  }

  async getHistory(entityId: string, from?: string, to?: string): Promise<TrustHistoryEntry[]> {
    const rows = await this.repo.getHistory(entityId, from, to);
    return rows.map((r) => ({
      timestamp: r.recordedAt.toISOString(),
      score:     r.score,
      event:     r.event,
      delta:     r.delta,
    }));
  }

  private async recalculate(entityId: string, entityType: string, triggerEvent: string): Promise<TrustScore> {
    const signalRows = await this.repo.getSignals(entityId);
    const existing   = await this.repo.findTrustScore(entityId, entityType);
    const baseScore  = existing?.overallScore ?? 30;

    // Apply recency-weighted signal accumulation
    let delta = 0;
    const recent = signalRows.slice(0, 10); // last 10 signals drive the delta
    for (const s of recent) {
      delta += Number(s.value) * 0.1;
    }

    const newScore     = Math.min(100, Math.max(0, Math.round(baseScore + delta)));
    const newFraud     = Math.min(100, Math.max(0, 100 - newScore));
    const components: TrustComponent[] = [
      { name: 'identity',      score: Math.min(100, newScore + 5),  weight: 0.4, last_updated: new Date().toISOString() },
      { name: 'behaviour',     score: Math.min(100, newScore),       weight: 0.3, last_updated: new Date().toISOString() },
      { name: 'financial',     score: Math.min(100, newScore - 5),  weight: 0.2, last_updated: new Date().toISOString() },
      { name: 'social_graph',  score: Math.min(100, newScore - 10), weight: 0.1, last_updated: new Date().toISOString() },
    ];

    const scoreDelta = newScore - baseScore;
    const row = await this.repo.upsertTrustScore({
      id:           existing?.id ?? uuidv4(),
      entityId,
      entityType,
      overallScore: newScore,
      components,
      tier:         scoreToTier(newScore),
      riskLevel:    scoreToRisk(newScore),
      fraudScore:   newFraud,
      signalsCount: signalRows.length,
    });

    if (scoreDelta !== 0) {
      await this.repo.insertHistoryEntry({ entityId, entityType, score: newScore, event: triggerEvent, delta: scoreDelta });
    }

    logger.info('Trust score recalculated', { entityId, score: newScore, tier: scoreToTier(newScore) });
    return {
      entity_id:            row.entityId,
      entity_type:          row.entityType,
      overall_score:        row.overallScore,
      components:           row.components as TrustComponent[],
      tier:                 row.tier as TrustScore['tier'],
      risk_level:           row.riskLevel as TrustScore['risk_level'],
      fraud_score:          row.fraudScore,
      signals_count:        row.signalsCount,
      last_recalculated_at: row.lastRecalculatedAt.toISOString(),
      created_at:           row.createdAt.toISOString(),
    };
  }
}

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../index';
import { PolicyRepository } from '../repositories/policy.repository';

export interface Policy {
  id:              string;
  name:            string;
  description?:    string;
  type:            string;
  scope:           string;
  country?:        string;
  institution_id?: string;
  service?:        string;
  rules:           PolicyRule[];
  active:          boolean;
  effective_from?: string;
  effective_until?: string;
  created_at:      string;
  updated_at:      string;
}

export interface PolicyRule {
  condition: string;
  action:    string;
  priority:  number;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  allowed:            boolean;
  action:             string;
  matched_policy_id?: string;
  matched_rule?:      PolicyRule;
  reason?:            string;
  risk_signals:       string[];
}

function rowToPolicy(r: Record<string, unknown>): Policy {
  return {
    id:              r['id'] as string,
    name:            r['name'] as string,
    description:     r['description'] as string | undefined,
    type:            r['type'] as string,
    scope:           r['scope'] as string,
    country:         r['country'] as string | undefined,
    institution_id:  r['institutionId'] as string | undefined,
    service:         r['service'] as string | undefined,
    rules:           r['rules'] as PolicyRule[],
    active:          r['active'] as boolean,
    effective_from:  r['effectiveFrom'] ? (r['effectiveFrom'] as Date).toISOString() : undefined,
    effective_until: r['effectiveUntil'] ? (r['effectiveUntil'] as Date).toISOString() : undefined,
    created_at:      (r['createdAt'] as Date).toISOString(),
    updated_at:      (r['updatedAt'] as Date).toISOString(),
  };
}

export class PolicyEngine {
  private repo = new PolicyRepository();

  async createPolicy(data: Omit<Policy, 'id' | 'created_at' | 'updated_at'>): Promise<Policy> {
    const row = await this.repo.insert({
      id:             uuidv4(),
      name:           data.name,
      description:    data.description ?? null,
      type:           data.type,
      scope:          data.scope,
      country:        data.country ?? null,
      institutionId:  data.institution_id ?? null,
      service:        data.service ?? null,
      rules:          data.rules,
      active:         data.active,
      effectiveFrom:  data.effective_from ? new Date(data.effective_from) : null,
      effectiveUntil: data.effective_until ? new Date(data.effective_until) : null,
    });
    logger.info('Policy created', { id: row.id, type: row.type, scope: row.scope });
    return rowToPolicy(row as unknown as Record<string, unknown>);
  }

  async getPolicy(id: string): Promise<Policy | null> {
    const row = await this.repo.findById(id);
    return row ? rowToPolicy(row as unknown as Record<string, unknown>) : null;
  }

  async listPolicies(opts: {
    scope?:   string;
    country?: string;
    service?: string;
    active?:  boolean;
    page?:    number;
    limit?:   number;
  }): Promise<{ policies: Policy[]; total: number }> {
    const { data, total } = await this.repo.list({
      scope:   opts.scope,
      country: opts.country,
      service: opts.service,
      active:  opts.active,
      page:    opts.page ?? 1,
      limit:   opts.limit ?? 50,
    });
    return { policies: data.map((r) => rowToPolicy(r as unknown as Record<string, unknown>)), total };
  }

  async updatePolicy(id: string, data: Partial<Omit<Policy, 'id' | 'created_at' | 'updated_at'>>): Promise<Policy> {
    const row = await this.repo.update(id, {
      name:           data.name,
      description:    data.description,
      rules:          data.rules,
      active:         data.active,
      effectiveFrom:  data.effective_from ? new Date(data.effective_from) : undefined,
      effectiveUntil: data.effective_until ? new Date(data.effective_until) : undefined,
    });
    if (!row) throw new Error(`Policy ${id} not found`);
    logger.info('Policy updated', { id });
    return rowToPolicy(row as unknown as Record<string, unknown>);
  }

  async deactivatePolicy(id: string): Promise<void> {
    await this.repo.deactivate(id);
    logger.info('Policy deactivated', { id });
  }

  async validateRequest(request: {
    type:            string;
    scope:           string;
    country?:        string;
    institution_id?: string;
    service?:        string;
    context:         Record<string, unknown>;
  }): Promise<ValidationResult> {
    const activePolicies = await this.repo.listActive({
      country:       request.country,
      institutionId: request.institution_id,
      service:       request.service,
    });

    const applicable = activePolicies.filter((p) => p.scope === request.scope || p.scope === 'global');
    if (!applicable.length) {
      return { allowed: true, action: 'permit', reason: 'No applicable policy — default permit', risk_signals: [] };
    }

    const rules = applicable
      .flatMap((p) => (p.rules as PolicyRule[]).map((r) => ({ ...r, policyId: p.id })))
      .sort((a, b) => b.priority - a.priority);

    const risk_signals: string[] = [];

    for (const rule of rules as (PolicyRule & { policyId: string })[]) {
      const matched = this.evaluateCondition(rule.condition, request.context);
      if (matched) {
        if (rule.action !== 'permit') risk_signals.push(`policy:${rule.policyId}:${rule.condition}`);
        return {
          allowed:            rule.action === 'permit',
          action:             rule.action,
          matched_policy_id:  rule.policyId,
          matched_rule:       rule,
          reason:             `Matched rule: ${rule.condition} → ${rule.action}`,
          risk_signals,
        };
      }
    }

    return { allowed: true, action: 'permit', reason: 'No rule matched — default permit', risk_signals };
  }

  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    // Simple key=value condition evaluator — extend in M4 with CEL or OPA
    const match = condition.match(/^(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (!match) return false;
    const [, key, op, val] = match;
    const ctxVal = context[key!];
    if (ctxVal === undefined) return false;
    const parsed = isNaN(Number(val)) ? val?.replace(/['"]/g, '') : Number(val);
    switch (op) {
      case '==': return ctxVal == parsed;
      case '!=': return ctxVal != parsed;
      case '>=': return Number(ctxVal) >= Number(parsed);
      case '<=': return Number(ctxVal) <= Number(parsed);
      case '>':  return Number(ctxVal) >  Number(parsed);
      case '<':  return Number(ctxVal) <  Number(parsed);
      default:   return false;
    }
  }
}

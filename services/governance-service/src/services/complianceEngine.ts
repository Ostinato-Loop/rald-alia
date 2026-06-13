// services/governance-service/src/services/complianceEngine.ts
// Full compliance enforcement: country-rule checks, framework registry,
// alias-creation gate, and compliance report generation.

import { eq, and, ne, count as drizzleCount } from 'drizzle-orm';
import { getDb, aliases } from '@rald-alia/db';
import { CountryRulesEngine, type CountryProfile } from './countryRules';

export interface ComplianceCheckResult {
  entity_id:         string;
  country:           string;
  action:            string;
  compliant:         boolean;
  violations:        string[];
  warnings:          string[];
  requires_review:   boolean;
  frameworks_checked: string[];
  checked_at:        string;
}

export interface AliasCreationCheckResult {
  allowed:                   boolean;
  violations:                string[];
  warnings:                  string[];
  country_profile:           CountryProfile | null;
  current_alias_count:       number;
  max_alias_per_user:        number;
  kyc_mandatory:             boolean;
  alias_verification_required: boolean;
}

export interface ComplianceFramework {
  id:             string;
  name:           string;
  country:        string;
  version:        string;
  effective_date: string;
  requirements:   string[];
}

const FRAMEWORKS: ComplianceFramework[] = [
  {
    id: 'CBN_OPEN_BANKING', name: 'CBN Open Banking Framework',
    country: 'NG', version: '1.0', effective_date: '2023-01-01',
    requirements: ['KYC_TIER_2', 'BVN_VERIFIED', 'NIN_VERIFIED', 'CONSENT_RECORDED', 'AUDIT_LOGGED'],
  },
  {
    id: 'NDPR', name: 'Nigeria Data Protection Regulation',
    country: 'NG', version: '2019', effective_date: '2019-01-25',
    requirements: ['EXPLICIT_CONSENT', 'DATA_MINIMIZATION', 'RETENTION_POLICY', 'RIGHT_TO_ERASURE'],
  },
  {
    id: 'NFIU_REGULATIONS', name: 'Nigeria Financial Intelligence Unit Regulations',
    country: 'NG', version: '2022', effective_date: '2022-06-01',
    requirements: ['STR_REPORTING', 'CTR_REPORTING', 'KYC_AML', 'SANCTIONS_SCREENING'],
  },
  {
    id: 'BOG_OPEN_BANKING', name: 'Bank of Ghana Open Banking Guidelines',
    country: 'GH', version: '1.0', effective_date: '2022-06-01',
    requirements: ['GHANA_CARD_VERIFIED', 'CONSENT_RECORDED', 'AUDIT_LOGGED'],
  },
  {
    id: 'BOG_AML', name: 'Bank of Ghana AML/CFT Directive',
    country: 'GH', version: '2022', effective_date: '2022-01-01',
    requirements: ['KYC_MANDATORY', 'TRANSACTION_MONITORING', 'STR_REPORTING'],
  },
  {
    id: 'DATA_PROTECTION_ACT_GH', name: 'Ghana Data Protection Act 2012',
    country: 'GH', version: '2012', effective_date: '2012-10-01',
    requirements: ['EXPLICIT_CONSENT', 'DATA_MINIMIZATION', 'RIGHT_TO_ERASURE'],
  },
  {
    id: 'CBK_PRUDENTIAL', name: 'CBK Prudential Guidelines',
    country: 'KE', version: '2022', effective_date: '2022-01-01',
    requirements: ['NATIONAL_ID_VERIFIED', 'KRA_PIN_VERIFIED', 'CONSENT_RECORDED'],
  },
  {
    id: 'DATA_PROTECTION_ACT_KE', name: 'Kenya Data Protection Act 2019',
    country: 'KE', version: '2019', effective_date: '2019-11-08',
    requirements: ['EXPLICIT_CONSENT', 'DATA_MINIMIZATION', 'RIGHT_TO_ERASURE'],
  },
  {
    id: 'FAIS', name: 'Financial Advisory and Intermediary Services Act',
    country: 'ZA', version: '2002', effective_date: '2004-03-01',
    requirements: ['FIT_AND_PROPER', 'DISCLOSURE', 'TCF'],
  },
  {
    id: 'FICA', name: 'Financial Intelligence Centre Act',
    country: 'ZA', version: '2001', effective_date: '2003-02-28',
    requirements: ['SA_ID_VERIFIED', 'RISK_ASSESSMENT', 'TRANSACTION_MONITORING'],
  },
  {
    id: 'POPIA', name: 'Protection of Personal Information Act',
    country: 'ZA', version: '2013', effective_date: '2021-07-01',
    requirements: ['LAWFUL_PROCESSING', 'DATA_MINIMIZATION', 'INFORMATION_QUALITY', 'CONSENT_REQUIRED'],
  },
  {
    id: 'NCA', name: 'National Credit Act',
    country: 'ZA', version: '2005', effective_date: '2007-06-01',
    requirements: ['AFFORDABILITY_ASSESSMENT', 'DISCLOSURE', 'COOLING_OFF_PERIOD'],
  },
  {
    id: 'BNR_AML', name: 'National Bank of Rwanda AML/CFT Guidelines',
    country: 'RW', version: '2021', effective_date: '2021-01-01',
    requirements: ['NATIONAL_ID_VERIFIED', 'RISK_ASSESSMENT', 'TRANSACTION_MONITORING'],
  },
  {
    id: 'RWANDA_DATA_PROTECTION', name: 'Rwanda Data Protection Law',
    country: 'RW', version: '2021', effective_date: '2021-10-15',
    requirements: ['EXPLICIT_CONSENT', 'DATA_MINIMIZATION', 'RIGHT_TO_ERASURE'],
  },
];

export class ComplianceEngine {
  private db          = getDb();
  private countryRules = new CountryRulesEngine();

  async runComplianceCheck(params: {
    entity_id:  string;
    entity_type: string;
    country:    string;
    action:     string;
    amount?:    number;
    currency?:  string;
  }): Promise<ComplianceCheckResult> {
    const code             = params.country.toUpperCase();
    const countryFrameworks = FRAMEWORKS.filter((f) => f.country === code);
    const profile          = this.countryRules.getProfile(code);
    const rules            = this.countryRules.getRules(code);
    const violations:   string[] = [];
    const warnings:     string[] = [];

    if (!profile) {
      violations.push(`Country ${code} is not a supported ALIA jurisdiction`);
      return {
        entity_id: params.entity_id, country: code, action: params.action,
        compliant: false, violations, warnings, requires_review: false,
        frameworks_checked: [], checked_at: new Date().toISOString(),
      };
    }

    if (params.amount && params.currency) {
      const txResult = this.countryRules.validateTransaction(code, {
        amount: params.amount, currency: params.currency,
        alias_type: 'system', initiator_id: params.entity_id, recipient_id: 'n/a',
      });
      violations.push(...txResult.violations);
      warnings.push(...txResult.warnings);
    }

    if (rules && params.amount && params.amount >= rules.rules.reporting_threshold) {
      warnings.push(
        `Amount ${params.amount} ${profile.currency} meets the ${profile.name} ` +
        `regulatory reporting threshold. STR applies under ${profile.compliance_frameworks.join(', ')}.`,
      );
    }

    if (code === 'NG' && params.action === 'alias.create') {
      if (rules?.rules.require_bvn) warnings.push('BVN verification required for Nigerian alias registration');
      if (rules?.rules.require_nin) warnings.push('NIN verification required for Nigerian alias registration');
    }

    return {
      entity_id:         params.entity_id,
      country:           code,
      action:            params.action,
      compliant:         violations.length === 0,
      violations,
      warnings,
      requires_review:   warnings.length > 0,
      frameworks_checked: countryFrameworks.map((f) => f.id),
      checked_at:        new Date().toISOString(),
    };
  }

  async checkAliasCreation(params: {
    user_id:     string;
    country:     string;
    alias_type:  string;
    is_verified?: boolean;
  }): Promise<AliasCreationCheckResult> {
    const code    = params.country.toUpperCase();
    const profile = this.countryRules.getProfile(code);
    const rules   = this.countryRules.getRules(code);
    const violations: string[] = [];
    const warnings:   string[] = [];

    if (!profile || !rules) {
      return {
        allowed: false,
        violations: [`Country ${code} is not supported by ALIA`],
        warnings: [],
        country_profile: null,
        current_alias_count: 0,
        max_alias_per_user: 0,
        kyc_mandatory: false,
        alias_verification_required: false,
      };
    }

    const [countResult] = await this.db
      .select({ value: drizzleCount() })
      .from(aliases)
      .where(and(
        eq(aliases.entityId, params.user_id),
        eq(aliases.entityType, 'user'),
        ne(aliases.status, 'archived'),
      ));

    const currentCount = Number(countResult?.value ?? 0);
    const maxAllowed   = rules.rules.max_alias_per_user;

    if (currentCount >= maxAllowed) {
      violations.push(
        `Alias limit exceeded: ${profile.name} rules allow a maximum of ${maxAllowed} active ` +
        `aliases per user. Current count: ${currentCount}.`,
      );
    }

    if (rules.rules.kyc_mandatory && !params.is_verified) {
      violations.push(
        `KYC is mandatory in ${profile.name}. User must complete identity verification ` +
        `(${profile.identity_requirements.join(', ')}) before registering aliases.`,
      );
    }

    if (rules.rules.alias_verification_required) {
      warnings.push(
        `Alias verification is required in ${profile.name}. ` +
        `The alias value will receive a verification challenge before becoming active.`,
      );
    }

    return {
      allowed:                   violations.length === 0,
      violations,
      warnings,
      country_profile:           profile,
      current_alias_count:       currentCount,
      max_alias_per_user:        maxAllowed,
      kyc_mandatory:             rules.rules.kyc_mandatory,
      alias_verification_required: rules.rules.alias_verification_required,
    };
  }

  async generateReport(params: {
    institution_id?: string;
    country?:        string;
    from?:           string;
    to?:             string;
    type?:           string;
  }): Promise<Record<string, unknown>> {
    const code       = params.country?.toUpperCase();
    const frameworks = FRAMEWORKS.filter((f) => !code || f.country === code);
    const profile    = code ? this.countryRules.getProfile(code) : null;

    return {
      generated_at: new Date().toISOString(),
      params,
      jurisdiction: profile ? {
        country:              profile.code,
        name:                 profile.name,
        regulatory_body:      profile.regulatory_body,
        status:               profile.status,
        open_banking_standard: profile.open_banking_standard,
      } : null,
      frameworks,
      summary: {
        total_frameworks:  frameworks.length,
        total_requirements: frameworks.reduce((s, f) => s + f.requirements.length, 0),
      },
    };
  }

  getFrameworks(country?: string): ComplianceFramework[] {
    const code = country?.toUpperCase();
    return code ? FRAMEWORKS.filter((f) => f.country === code) : FRAMEWORKS;
  }
}

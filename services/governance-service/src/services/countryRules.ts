// services/governance-service/src/services/countryRules.ts
// Country governance profiles and compliance rules for all ALIA-supported jurisdictions.

export interface CountryProfile {
  code:                  string;
  name:                  string;
  currency:              string;
  regulatory_body:       string;
  open_banking_standard: string;
  data_residency_required: boolean;
  identity_requirements: string[];
  transaction_limits: {
    daily_individual:    number;
    daily_business:      number;
    single_transaction:  number;
  };
  kyc_tiers:             KYCTier[];
  compliance_frameworks: string[];
  status:                'active' | 'pending' | 'planned';
}

export interface KYCTier {
  tier:               number;
  name:               string;
  daily_limit:        number;
  documents_required: string[];
}

export interface CountryRule {
  code:  string;
  rules: {
    require_bvn?:              boolean;
    require_nin?:              boolean;
    require_ghana_card?:       boolean;
    require_national_id?:      boolean;
    max_alias_per_user:        number;
    alias_verification_required: boolean;
    kyc_mandatory:             boolean;
    reporting_threshold:       number;
  };
}

export interface TransactionValidationResult {
  valid:      boolean;
  violations: string[];
  warnings:   string[];
}

const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  NG: {
    code:                    'NG',
    name:                    'Nigeria',
    currency:                'NGN',
    regulatory_body:         'Central Bank of Nigeria (CBN)',
    open_banking_standard:   'CBN Open Banking Framework',
    data_residency_required: true,
    identity_requirements:   ['BVN', 'NIN'],
    transaction_limits: {
      daily_individual:   5_000_000,
      daily_business:    50_000_000,
      single_transaction: 10_000_000,
    },
    kyc_tiers: [
      { tier: 1, name: 'Basic',    daily_limit:    50_000, documents_required: ['phone_number'] },
      { tier: 2, name: 'Standard', daily_limit:   300_000, documents_required: ['BVN', 'NIN'] },
      { tier: 3, name: 'Enhanced', daily_limit: 5_000_000, documents_required: ['BVN', 'NIN', 'proof_of_address'] },
    ],
    compliance_frameworks: ['CBN_AML', 'NDPR', 'NFIU_REGULATIONS'],
    status: 'active',
  },
  GH: {
    code:                    'GH',
    name:                    'Ghana',
    currency:                'GHS',
    regulatory_body:         'Bank of Ghana (BoG)',
    open_banking_standard:   'BoG Open Banking Guidelines',
    data_residency_required: true,
    identity_requirements:   ['Ghana Card', 'Voter ID'],
    transaction_limits: {
      daily_individual:    50_000,
      daily_business:     500_000,
      single_transaction: 100_000,
    },
    kyc_tiers: [
      { tier: 1, name: 'Basic',    daily_limit:  1_000, documents_required: ['phone_number'] },
      { tier: 2, name: 'Standard', daily_limit: 10_000, documents_required: ['ghana_card'] },
      { tier: 3, name: 'Enhanced', daily_limit: 50_000, documents_required: ['ghana_card', 'proof_of_address', 'tax_id'] },
    ],
    compliance_frameworks: ['BOG_AML', 'DATA_PROTECTION_ACT_2012'],
    status: 'pending',
  },
  KE: {
    code:                    'KE',
    name:                    'Kenya',
    currency:                'KES',
    regulatory_body:         'Central Bank of Kenya (CBK)',
    open_banking_standard:   'CBK Digital Credit Guidelines',
    data_residency_required: false,
    identity_requirements:   ['National ID', 'KRA PIN'],
    transaction_limits: {
      daily_individual:   300_000,
      daily_business:   3_000_000,
      single_transaction: 500_000,
    },
    kyc_tiers: [
      { tier: 1, name: 'Basic',    daily_limit:  30_000, documents_required: ['phone_number'] },
      { tier: 2, name: 'Standard', daily_limit: 150_000, documents_required: ['national_id', 'kra_pin'] },
      { tier: 3, name: 'Enhanced', daily_limit: 300_000, documents_required: ['national_id', 'kra_pin', 'proof_of_address'] },
    ],
    compliance_frameworks: ['CBK_PRUDENTIAL', 'DATA_PROTECTION_ACT_2019'],
    status: 'planned',
  },
  ZA: {
    code:                    'ZA',
    name:                    'South Africa',
    currency:                'ZAR',
    regulatory_body:         'South African Reserve Bank (SARB)',
    open_banking_standard:   'SARB Open Finance Policy',
    data_residency_required: false,
    identity_requirements:   ['South African ID', 'Passport'],
    transaction_limits: {
      daily_individual:   200_000,
      daily_business:   2_000_000,
      single_transaction: 500_000,
    },
    kyc_tiers: [
      { tier: 1, name: 'Basic',    daily_limit:   5_000, documents_required: ['phone_number'] },
      { tier: 2, name: 'Standard', daily_limit:  50_000, documents_required: ['sa_id'] },
      { tier: 3, name: 'Enhanced', daily_limit: 200_000, documents_required: ['sa_id', 'proof_of_address', 'tax_number'] },
    ],
    compliance_frameworks: ['FAIS', 'FICA', 'POPIA', 'NCA'],
    status: 'planned',
  },
  RW: {
    code:                    'RW',
    name:                    'Rwanda',
    currency:                'RWF',
    regulatory_body:         'National Bank of Rwanda (BNR)',
    open_banking_standard:   'BNR Digital Financial Services Policy',
    data_residency_required: true,
    identity_requirements:   ['Rwanda National ID'],
    transaction_limits: {
      daily_individual:    2_000_000,
      daily_business:     20_000_000,
      single_transaction:  5_000_000,
    },
    kyc_tiers: [
      { tier: 1, name: 'Basic',    daily_limit:   100_000, documents_required: ['phone_number'] },
      { tier: 2, name: 'Standard', daily_limit:   500_000, documents_required: ['national_id'] },
      { tier: 3, name: 'Enhanced', daily_limit: 2_000_000, documents_required: ['national_id', 'proof_of_address'] },
    ],
    compliance_frameworks: ['BNR_AML', 'RWANDA_DATA_PROTECTION'],
    status: 'planned',
  },
};

const COUNTRY_RULES: Record<string, CountryRule> = {
  NG: {
    code:  'NG',
    rules: {
      require_bvn:               true,
      require_nin:               true,
      max_alias_per_user:        10,
      alias_verification_required: true,
      kyc_mandatory:             true,
      reporting_threshold:       5_000_000,
    },
  },
  GH: {
    code:  'GH',
    rules: {
      require_ghana_card:        true,
      max_alias_per_user:        5,
      alias_verification_required: true,
      kyc_mandatory:             true,
      reporting_threshold:       10_000,
    },
  },
  KE: {
    code:  'KE',
    rules: {
      require_national_id:       true,
      max_alias_per_user:        5,
      alias_verification_required: true,
      kyc_mandatory:             true,
      reporting_threshold:       150_000,
    },
  },
  ZA: {
    code:  'ZA',
    rules: {
      require_national_id:       true,
      max_alias_per_user:        5,
      alias_verification_required: true,
      kyc_mandatory:             true,
      reporting_threshold:       25_000,
    },
  },
  RW: {
    code:  'RW',
    rules: {
      require_national_id:       true,
      max_alias_per_user:        5,
      alias_verification_required: true,
      kyc_mandatory:             true,
      reporting_threshold:       1_000_000,
    },
  },
};

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_PROFILES) as (keyof typeof COUNTRY_PROFILES)[];

export class CountryRulesEngine {
  getProfile(code: string): CountryProfile | null {
    return COUNTRY_PROFILES[code.toUpperCase()] ?? null;
  }

  getRules(code: string): CountryRule | null {
    return COUNTRY_RULES[code.toUpperCase()] ?? null;
  }

  getComplianceRequirements(code: string): Record<string, unknown> {
    const profile = this.getProfile(code);
    const rules   = this.getRules(code);
    if (!profile || !rules) return {};
    return {
      country:              code,
      frameworks:           profile.compliance_frameworks,
      kyc_tiers:            profile.kyc_tiers,
      transaction_limits:   profile.transaction_limits,
      identity_requirements: profile.identity_requirements,
      alias_rules:          rules.rules,
    };
  }

  validateTransaction(
    code: string,
    tx: { amount: number; currency: string; alias_type: string; initiator_id: string; recipient_id: string },
  ): TransactionValidationResult {
    const profile = this.getProfile(code);
    if (!profile) {
      return { valid: false, violations: [`Country ${code} not supported`], warnings: [] };
    }

    const violations: string[] = [];
    const warnings:   string[] = [];

    if (tx.amount > profile.transaction_limits.single_transaction) {
      violations.push(
        `Amount ${tx.amount} ${profile.currency} exceeds single-transaction limit of ` +
        `${profile.transaction_limits.single_transaction} ${profile.currency} set by ${profile.regulatory_body}`,
      );
    }

    const rules = this.getRules(code);
    if (rules && tx.amount >= rules.rules.reporting_threshold) {
      warnings.push(
        `Amount meets the ${profile.name} regulatory reporting threshold ` +
        `(${rules.rules.reporting_threshold} ${profile.currency}). ` +
        `Automatic STR submission applies under ${profile.compliance_frameworks.join(', ')}.`,
      );
    }

    return { valid: violations.length === 0, violations, warnings };
  }

  isSupported(code: string): boolean {
    return code.toUpperCase() in COUNTRY_PROFILES;
  }
}

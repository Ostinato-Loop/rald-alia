// packages/sdk/src/types.ts
// Shared request / response types for the ALIA SDK.

// ── SDK Configuration ─────────────────────────────────────────────────────────

export interface AliaSDKConfig {
  /** Your ALIA API key (rald_key_prod_* or rald_key_test_*). */
  apiKey: string;
  /** Override the base URL. Defaults to https://api.alia.network */
  baseUrl?: string;
  /** Request timeout in milliseconds. Default: 30000. */
  timeoutMs?: number;
  /** Number of retries on 5xx / network errors. Default: 2. */
  maxRetries?: number;
  /** Custom headers added to every request. */
  headers?: Record<string, string>;
}

// ── Alias ─────────────────────────────────────────────────────────────────────

export type AliasType =
  | 'phone'
  | 'email'
  | 'national_id'
  | 'bvn'
  | 'passport'
  | 'business_reg';

export type AliasStatus = 'pending' | 'active' | 'suspended' | 'archived';

export interface Alias {
  id:         string;
  alias:      string;
  type:       AliasType;
  status:     AliasStatus;
  country:    string;
  entity_id?: string;
  routing:    AliasRouting;
  created_at: string;
  updated_at: string;
}

export interface AliasRouting {
  bank_code?:         string;
  account_number?:    string;
  institution_id?:    string;
  settlement_scheme?: string;
}

export interface ResolveAliasParams {
  alias:   string;
  country: string;
}

export interface CreateAliasParams {
  alias:      string;
  type:       AliasType;
  country:    string;
  entity_id?: string;
  routing:    AliasRouting;
}

// ── Identity ──────────────────────────────────────────────────────────────────

export type IdentityStatus = 'pending' | 'verified' | 'failed' | 'expired';

export interface IdentityVerification {
  id:           string;
  subject_id:   string;
  country:      string;
  status:       IdentityStatus;
  kyc_level:    number;
  verified_at?: string;
  expires_at?:  string;
  created_at:   string;
}

export interface VerifyIdentityParams {
  subject_id:      string;
  country:         string;
  document_type:   'national_id' | 'passport' | 'bvn' | 'drivers_license';
  document_number: string;
  first_name:      string;
  last_name:       string;
  date_of_birth?:  string;
}

// ── Trust ─────────────────────────────────────────────────────────────────────

export interface TrustScore {
  entity_id:   string;
  score:       number;
  tier:        'low' | 'medium' | 'high' | 'premium';
  factors:     TrustFactor[];
  computed_at: string;
}

export interface TrustFactor {
  name:   string;
  weight: number;
  value:  number;
}

// ── Consent ───────────────────────────────────────────────────────────────────

export type ConsentStatus = 'pending' | 'granted' | 'denied' | 'revoked' | 'expired';

export interface Consent {
  id:           string;
  subject_id:   string;
  requestor_id: string;
  scope:        string[];
  status:       ConsentStatus;
  granted_at?:  string;
  expires_at?:  string;
  created_at:   string;
}

export interface GrantConsentParams {
  subject_id:       string;
  requestor_id:     string;
  scope:            string[];
  expires_in_days?: number;
}

// ── Routing ───────────────────────────────────────────────────────────────────

export type RoutingStatus = 'initiated' | 'processing' | 'settled' | 'failed' | 'reversed';

export interface RoutingRequest {
  id:                string;
  source_alias:      string;
  destination_alias: string;
  amount_minor:      number;
  currency:          string;
  status:            RoutingStatus;
  reference:         string;
  narration?:        string;
  initiated_at:      string;
  settled_at?:       string;
}

export interface InitiateRoutingParams {
  source_alias:      string;
  destination_alias: string;
  amount_minor:      number;
  currency:          string;
  narration?:        string;
  idempotency_key:   string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export interface RegistryRecord {
  id:               string;
  entity_id:        string;
  entity_type:      string;
  country:          string;
  alias_status:     string;
  identity_status:  string;
  trust_tier:       string;
  kyc_level:        number;
  consent_status:   string;
  merchant_status?: string;
  routing_status?:  string;
  last_synced_at:   string;
}

// ── Common ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data:    T;
  meta?:   Record<string, unknown>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page:  number;
    limit: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALIA Connect — Integration Engine types
// ═══════════════════════════════════════════════════════════════════════════════

// ── Partner ───────────────────────────────────────────────────────────────────

export type PartnerType =
  | 'bank'
  | 'processor'
  | 'wallet'
  | 'mobile_money'
  | 'card_issuer'
  | 'government'
  | 'merchant'
  | 'marketplace'
  | 'school'
  | 'university'
  | 'trade_platform';

export type PartnerStatus = 'pending' | 'approved' | 'suspended' | 'inactive';

export interface Partner {
  id:            string;
  name:          string;
  type:          PartnerType;
  status:        PartnerStatus;
  api_key:       string;
  sandbox_key:   string;
  scopes:        string[];
  country:       string;
  webhook_url?:  string;
  website_url?:  string;
  contact_email: string;
  created_at:    string;
}

export interface RegisterPartnerParams {
  name:          string;
  type:          PartnerType;
  country:       string;
  contact_email: string;
  webhook_url?:  string;
  website_url?:  string;
}

export interface WebhookConfig {
  id:         string;
  url:        string;
  events:     string[];
  active:     boolean;
  secret:     string;
  created_at: string;
}

export interface CreateWebhookParams {
  url:    string;
  events: string[];
}

export interface UpdateWebhookParams {
  url?:    string;
  events?: string[];
  active?: boolean;
}

export interface WebhookTestResult {
  webhook_id:  string;
  event:       string;
  status_code: number;
  response_ms: number;
  success:     boolean;
  error?:      string;
  sent_at:     string;
}

// ── Payment ───────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'reversed';

export interface Payment {
  id:                string;
  source_alias:      string;
  destination_alias: string;
  amount_minor:      number;
  currency:          string;
  status:            PaymentStatus;
  reference:         string;
  narration?:        string;
  merchant_id?:      string;
  idempotency_key:   string;
  processor_ref?:    string;
  routing_metadata?: Record<string, unknown>;
  initiated_at:      string;
  completed_at?:     string;
}

export interface InitiatePaymentParams {
  source_alias:      string;
  destination_alias: string;
  amount_minor:      number;
  currency:          string;
  narration?:        string;
  merchant_id?:      string;
  idempotency_key:   string;
  metadata?:         Record<string, unknown>;
}

export interface VerifyPaymentParams {
  payment_id?: string;
  reference?:  string;
}

// ── Merchant ──────────────────────────────────────────────────────────────────

export type MerchantStatus   = 'pending' | 'active' | 'suspended';
export type MerchantCategory =
  | 'retail'
  | 'digital_services'
  | 'marketplace'
  | 'school'
  | 'government'
  | 'trade'
  | 'subscription'
  | 'other';

export interface Merchant {
  id:           string;
  alias:        string;
  name:         string;
  category:     MerchantCategory;
  status:       MerchantStatus;
  trust_score:  number;
  checkout_url: string;
  public_key:   string;
  country:      string;
  logo_url?:    string;
  website_url?: string;
  webhook_url?: string;
  created_at:   string;
}

export interface RegisterMerchantParams {
  name:         string;
  alias:        string;
  category:     MerchantCategory;
  country:      string;
  webhook_url?: string;
  logo_url?:    string;
  website_url?: string;
}

export interface CheckoutSession {
  id:           string;
  merchant_id:  string;
  amount_minor: number;
  currency:     string;
  reference:    string;
  narration?:   string;
  checkout_url: string;
  expires_at:   string;
  status:       'open' | 'completed' | 'expired';
  metadata?:    Record<string, unknown>;
}

export interface CreateCheckoutParams {
  amount_minor:    number;
  currency:        string;
  reference:       string;
  narration?:      string;
  customer_alias?: string;
  redirect_url?:   string;
  metadata?:       Record<string, unknown>;
}

// ── Subscription ──────────────────────────────────────────────────────────────

export type SubscriptionStatus   = 'active' | 'paused' | 'cancelled' | 'expired' | 'pending';
export type SubscriptionInterval = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface SubscriptionPlan {
  id:           string;
  merchant_id:  string;
  name:         string;
  amount_minor: number;
  currency:     string;
  interval:     SubscriptionInterval;
  trial_days:   number;
  active:       boolean;
  description?: string;
  metadata?:    Record<string, unknown>;
  created_at:   string;
}

export interface Subscription {
  id:                   string;
  merchant_id:          string;
  customer_alias:       string;
  plan_id:              string;
  status:               SubscriptionStatus;
  amount_minor:         number;
  currency:             string;
  interval:             SubscriptionInterval;
  current_period_start: string;
  current_period_end:   string;
  trial_ends_at?:       string;
  created_at:           string;
  cancelled_at?:        string;
  metadata?:            Record<string, unknown>;
}

export interface CreateSubscriptionParams {
  customer_alias:  string;
  plan_id:         string;
  idempotency_key: string;
  trial_days?:     number;
  metadata?:       Record<string, unknown>;
}

export interface CancelSubscriptionParams {
  reason?:               string;
  cancel_at_period_end?: boolean;
}

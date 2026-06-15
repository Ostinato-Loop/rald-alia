// packages/sdk/src/index.ts
// Public API surface of @rald-alia/sdk

// ── Main SDK class ────────────────────────────────────────────────────────────
export { AliaSDK }             from './AliaSDK';
export { AliaHttpClient }      from './client';

// ── Core identity modules ─────────────────────────────────────────────────────
export { AliasClient }         from './modules/alias';
export { IdentityClient }      from './modules/identity';
export { TrustClient }         from './modules/trust';
export { ConsentClient }       from './modules/consent';
export { RoutingClient }       from './modules/routing';
export { RegistryClient }      from './modules/registry';

// ── ALIA Connect — Integration Engine ────────────────────────────────────────
export { PartnerClient }       from './modules/partner';
export { PaymentClient }       from './modules/payment';
export { MerchantClient }      from './modules/merchant';
export { SubscriptionClient }  from './modules/subscription';

// ── Errors ────────────────────────────────────────────────────────────────────
export {
  AliaError,
  AliaApiError,
  AliaAuthError,
  AliaForbiddenError,
  AliaNotFoundError,
  AliaCountryNotOperationalError,
  AliaRateLimitError,
  AliaNetworkError,
} from './errors';

// ── Types — Core ──────────────────────────────────────────────────────────────
export type {
  AliaSDKConfig,
  // Alias
  AliasType, AliasStatus, Alias, AliasRouting,
  ResolveAliasParams, CreateAliasParams,
  // Identity
  IdentityStatus, IdentityVerification, VerifyIdentityParams,
  // Trust
  TrustScore, TrustFactor,
  // Consent
  ConsentStatus, Consent, GrantConsentParams,
  // Routing
  RoutingStatus, RoutingRequest, InitiateRoutingParams,
  // Registry
  RegistryRecord,
  // Common
  ApiResponse, PaginatedResponse,
} from './types';

// ── Types — ALIA Connect ──────────────────────────────────────────────────────
export type {
  // Partner
  PartnerType, PartnerStatus, Partner,
  RegisterPartnerParams,
  WebhookConfig, CreateWebhookParams, UpdateWebhookParams, WebhookTestResult,
  // Payment
  PaymentStatus, Payment,
  InitiatePaymentParams, VerifyPaymentParams,
  // Merchant
  MerchantStatus, MerchantCategory, Merchant,
  RegisterMerchantParams, CheckoutSession, CreateCheckoutParams,
  // Subscription
  SubscriptionStatus, SubscriptionInterval, SubscriptionPlan, Subscription,
  CreateSubscriptionParams, CancelSubscriptionParams,
} from './types';

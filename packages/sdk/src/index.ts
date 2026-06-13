// packages/sdk/src/index.ts
// Public API surface of @rald-alia/sdk

export { AliaSDK }                   from './AliaSDK';
export { AliaHttpClient }            from './client';
export { AliasClient }               from './modules/alias';
export { IdentityClient }            from './modules/identity';
export { TrustClient }               from './modules/trust';
export { ConsentClient }             from './modules/consent';
export { RoutingClient }             from './modules/routing';
export { RegistryClient }            from './modules/registry';

// Errors
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

// Types
export type {
  AliaSDKConfig,
  AliasType,
  AliasStatus,
  Alias,
  AliasRouting,
  ResolveAliasParams,
  CreateAliasParams,
  IdentityStatus,
  IdentityVerification,
  VerifyIdentityParams,
  TrustScore,
  TrustFactor,
  ConsentStatus,
  Consent,
  GrantConsentParams,
  RoutingStatus,
  RoutingRequest,
  InitiateRoutingParams,
  RegistryRecord,
  ApiResponse,
  PaginatedResponse,
} from './types';

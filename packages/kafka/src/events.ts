export const KAFKA_TOPICS = {
  ALIAS_CREATED: 'alias.created',
  ALIAS_UPDATED: 'alias.updated',
  ALIAS_DELETED: 'alias.deleted',
  BANK_LINKED: 'bank.linked',
  BANK_UNLINKED: 'bank.unlinked',
  RESOLUTION_REQUESTED: 'resolution.requested',
  RESOLUTION_COMPLETED: 'resolution.completed',
  FRAUD_DETECTED: 'fraud.detected',
  USER_VERIFIED: 'user.verified',
  CONSENT_GRANTED: 'consent.granted',
  CONSENT_REVOKED: 'consent.revoked',
  CONSENT_EXPIRED: 'consent.expired',
  MANDATE_CREATED: 'mandate.created',
  MANDATE_CANCELLED: 'mandate.cancelled',
  MANDATE_EXECUTED: 'mandate.executed',
  TRUST_SCORE_UPDATED: 'trust.score_updated',
  TRUST_SIGNAL_RECEIVED: 'trust.signal_received',
  TRUST_TIER_CHANGED: 'trust.tier_changed',
  MERCHANT_CREATED: 'merchant.created',
  MERCHANT_VERIFIED: 'merchant.verified',
  MERCHANT_SUSPENDED: 'merchant.suspended',
  MERCHANT_COLLECTION_CREATED: 'merchant.collection_created',
  MERCHANT_COLLECTION_COMPLETED: 'merchant.collection_completed',
  KYC_INITIATED: 'verification.kyc_initiated',
  KYC_APPROVED: 'verification.kyc_approved',
  KYC_REJECTED: 'verification.kyc_rejected',
  BVN_VERIFIED: 'verification.bvn_verified',
  NIN_VERIFIED: 'verification.nin_verified',
  CREDENTIAL_ISSUED: 'verification.credential_issued',
  CREDENTIAL_REVOKED: 'verification.credential_revoked',
  POLICY_CREATED: 'governance.policy_created',
  POLICY_VIOLATED: 'governance.policy_violated',
  COMPLIANCE_CHECK: 'governance.compliance_check',
  // Notification triggers — consumed by notification-service to send transactional emails
  NOTIFICATION_SEND_OTP: 'notification.send_otp',
  NOTIFICATION_SEND_PASSWORD_RESET: 'notification.send_password_reset',
  NOTIFICATION_WELCOME: 'notification.welcome',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

export interface BaseEvent {
  eventId: string;
  eventType: KafkaTopic;
  timestamp: string;
  version: string;
  correlationId?: string;
  traceId?: string;
  actorId?: string;
  actorType?: string;
}

export interface AliasCreatedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.ALIAS_CREATED;
  payload: {
    aliasId: string;
    userId: string;
    type: string;
    value: string;
    bankCode: string;
  };
}

export interface AliasUpdatedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.ALIAS_UPDATED;
  payload: { aliasId: string; userId: string; changes: Record<string, unknown> };
}

export interface AliasDeletedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.ALIAS_DELETED;
  payload: { aliasId: string; userId: string; value: string };
}

export interface BankLinkedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.BANK_LINKED;
  payload: { userId: string; bankCode: string; bankName: string; accountName: string; isPrimary: boolean };
}

export interface ResolutionRequestedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.RESOLUTION_REQUESTED;
  payload: { resolutionId: string; alias: string; aliasType: string; initiatingBankCode: string; transactionRef: string; ipAddress?: string };
}

export interface ResolutionCompletedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.RESOLUTION_COMPLETED;
  payload: { resolutionId: string; alias: string; token: string; destinationBankCode: string; latencyMs: number; success: boolean };
}

export interface FraudDetectedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.FRAUD_DETECTED;
  payload: { fraudId: string; entityId: string; entityType: 'alias' | 'user' | 'organization' | 'merchant'; riskScore: number; riskLevel: string; flags: string[]; action: 'review' | 'block' };
}

export interface UserVerifiedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.USER_VERIFIED;
  payload: { userId: string; verificationType: 'bvn' | 'nin' | 'email' | 'phone' };
}

export interface ConsentGrantedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.CONSENT_GRANTED;
  payload: { consentId: string; subjectId: string; granteeId: string; scope: string[]; expiresAt?: string };
}

export interface ConsentRevokedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.CONSENT_REVOKED;
  payload: { consentId: string; subjectId: string; granteeId: string; reason: string; revokedBy: string };
}

export interface MandateCreatedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.MANDATE_CREATED;
  payload: { mandateId: string; subjectId: string; merchantId: string; frequency: string; currency: string; maxAmount?: number };
}

export interface TrustScoreUpdatedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.TRUST_SCORE_UPDATED;
  payload: { entityId: string; entityType: string; previousScore: number; newScore: number; tier: string; signalType: string };
}

export interface MerchantCreatedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.MERCHANT_CREATED;
  payload: { merchantId: string; handle: string; name: string; category: string; country: string; ownerId: string };
}

export interface MerchantVerifiedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.MERCHANT_VERIFIED;
  payload: { merchantId: string; handle: string; verifiedBy: string };
}

export interface KYCApprovedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.KYC_APPROVED;
  payload: { sessionId: string; entityId: string; entityType: string; tier: string; country: string; reviewedBy: string };
}

export interface CredentialIssuedEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.CREDENTIAL_ISSUED;
  payload: { credentialId: string; subjectId: string; credentialType: string; issuerId: string; expiresAt?: string };
}

// Notification email trigger events
export interface NotificationSendOtpEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.NOTIFICATION_SEND_OTP;
  payload: { userId: string; email: string; firstName: string; otp: string };
}

export interface NotificationSendPasswordResetEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.NOTIFICATION_SEND_PASSWORD_RESET;
  payload: { userId: string; email: string; firstName: string; otp: string };
}

export interface NotificationWelcomeEvent extends BaseEvent {
  eventType: typeof KAFKA_TOPICS.NOTIFICATION_WELCOME;
  payload: { userId: string; email: string; firstName: string };
}

export type KafkaEvent =
  | AliasCreatedEvent
  | AliasUpdatedEvent
  | AliasDeletedEvent
  | BankLinkedEvent
  | ResolutionRequestedEvent
  | ResolutionCompletedEvent
  | FraudDetectedEvent
  | UserVerifiedEvent
  | ConsentGrantedEvent
  | ConsentRevokedEvent
  | MandateCreatedEvent
  | TrustScoreUpdatedEvent
  | MerchantCreatedEvent
  | MerchantVerifiedEvent
  | KYCApprovedEvent
  | CredentialIssuedEvent
  | NotificationSendOtpEvent
  | NotificationSendPasswordResetEvent
  | NotificationWelcomeEvent;

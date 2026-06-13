import {
  createConsumer,
  KAFKA_TOPICS,
  AliasCreatedEvent,
  ResolutionCompletedEvent,
  FraudDetectedEvent,
  UserVerifiedEvent,
  NotificationSendOtpEvent,
  NotificationSendPasswordResetEvent,
  NotificationWelcomeEvent,
} from '@rald-alia/kafka';
import { getDb } from '@rald-alia/db';
import { users } from '@rald-alia/db';
import { eq } from 'drizzle-orm';
import { NotificationService } from '../services/notification.service';

const notificationService = new NotificationService();

async function getUserById(userId: string): Promise<{ email: string; firstName: string } | null> {
  try {
    const db = getDb();
    const [user] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

export async function startConsumer() {
  await createConsumer({
    groupId: 'notification-service',
    topics: [
      KAFKA_TOPICS.ALIAS_CREATED,
      KAFKA_TOPICS.RESOLUTION_COMPLETED,
      KAFKA_TOPICS.FRAUD_DETECTED,
      KAFKA_TOPICS.USER_VERIFIED,
      KAFKA_TOPICS.NOTIFICATION_SEND_OTP,
      KAFKA_TOPICS.NOTIFICATION_SEND_PASSWORD_RESET,
      KAFKA_TOPICS.NOTIFICATION_WELCOME,
    ],
    handlers: {
      [KAFKA_TOPICS.NOTIFICATION_SEND_OTP]: async (event) => {
        const e = event as NotificationSendOtpEvent;
        console.log(`[notification-service] Sending OTP email to ${e.payload.email}`);
        void notificationService.sendVerificationEmail(e.payload.email, e.payload.firstName, e.payload.otp);
      },
      [KAFKA_TOPICS.NOTIFICATION_SEND_PASSWORD_RESET]: async (event) => {
        const e = event as NotificationSendPasswordResetEvent;
        console.log(`[notification-service] Sending password reset email to ${e.payload.email}`);
        void notificationService.sendPasswordResetEmail(e.payload.email, e.payload.firstName, e.payload.otp);
      },
      [KAFKA_TOPICS.NOTIFICATION_WELCOME]: async (event) => {
        const e = event as NotificationWelcomeEvent;
        console.log(`[notification-service] Sending welcome email to ${e.payload.email}`);
        void notificationService.sendWelcomeEmail(e.payload.email, e.payload.firstName);
      },
      [KAFKA_TOPICS.ALIAS_CREATED]: async (event) => {
        const e = event as AliasCreatedEvent;
        const user = await getUserById(e.payload.userId);
        if (user) {
          console.log(`[notification-service] Alias created: ${e.payload.value} — sending welcome email`);
          void notificationService.sendWelcomeEmail(user.email, user.firstName);
        }
      },
      [KAFKA_TOPICS.USER_VERIFIED]: async (event) => {
        const e = event as UserVerifiedEvent;
        const user = await getUserById(e.payload.userId);
        if (user) {
          console.log(`[notification-service] User verified: ${e.payload.userId} via ${e.payload.verificationType}`);
          void notificationService.sendSecurityAlert(
            user.email,
            user.firstName,
            'Account verified',
            `Your identity has been verified via ${e.payload.verificationType}.`,
          );
        }
      },
      [KAFKA_TOPICS.RESOLUTION_COMPLETED]: async (event) => {
        const e = event as ResolutionCompletedEvent;
        if (!e.payload.success) {
          console.log(`[notification-service] Resolution failed for ${e.payload.alias}`);
        }
      },
      [KAFKA_TOPICS.FRAUD_DETECTED]: async (event) => {
        const e = event as FraudDetectedEvent;
        console.log(`[notification-service] Fraud detected for ${e.payload.entityId} — level: ${e.payload.riskLevel}`);
        const securityEmail = process.env['SECURITY_ALERT_EMAIL'] ?? 'security@raldalia.com';
        void notificationService.sendEmail(
          securityEmail,
          `[SECURITY] Fraud Detected — ${e.payload.riskLevel.toUpperCase()}`,
          `<p>Fraud detected for entity <strong>${e.payload.entityId}</strong> (${e.payload.entityType}).</p><p>Risk Level: <strong>${e.payload.riskLevel}</strong> · Score: ${e.payload.riskScore}</p><p>Flags: ${e.payload.flags.join(', ')}</p><p>Action: ${e.payload.action}</p>`,
        );
      },
    },
  });
  console.log('[notification-service] Kafka consumer started');
}

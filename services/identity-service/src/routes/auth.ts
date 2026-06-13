import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '@rald-alia/db';
import { users } from '@rald-alia/db';
import { eq } from 'drizzle-orm';
import { publishEvent, KAFKA_TOPICS } from '@rald-alia/kafka';
import { generateId, ConflictError, NotFoundError } from '@rald-alia/shared';
import { claimIdentity, transitionUser } from '../services/identityStateMachine';

export const authRouter = Router();

// SECURITY: JWT secrets must be present — crash loudly if not configured.
// There are no dev fallbacks. This is intentional.
const JWT_SECRET = process.env['JWT_SECRET'];
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'];

if (!JWT_SECRET)         { console.error('[identity-service] FATAL: JWT_SECRET is not set');         process.exit(1); }
if (!JWT_REFRESH_SECRET) { console.error('[identity-service] FATAL: JWT_REFRESH_SECRET is not set'); process.exit(1); }

// HMAC key for BVN/NIN hashing — replaces plain SHA-256
// Never log or expose IDENTITY_HMAC_SECRET
const IDENTITY_HMAC_SECRET = process.env['IDENTITY_HMAC_SECRET'];
if (!IDENTITY_HMAC_SECRET) { console.error('[identity-service] FATAL: IDENTITY_HMAC_SECRET is not set'); process.exit(1); }

const SALT_ROUNDS = 12;

function generateOtp(): string {
  return String(crypto.randomInt(100_000, 999_999));
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// HMAC-SHA256 for BVN/NIN — server-side secret prevents rainbow table attacks
function hmacHash(value: string): string {
  return crypto.createHmac('sha256', IDENTITY_HMAC_SECRET!).update(value.trim()).digest('hex');
}

function signAccess(userId: string): string {
  return jwt.sign({ sub: userId, type: 'user' }, JWT_SECRET!, { expiresIn: '15m' });
}

function signRefresh(userId: string): string {
  return jwt.sign({ sub: userId, type: 'user' }, JWT_REFRESH_SECRET!, { expiresIn: '30d' });
}

type OtpMeta = {
  otpHash?:            string | null;
  otpExpiresAt?:       number | null;
  resetOtpHash?:       string | null;
  resetOtpExpiresAt?:  number | null;
  [key: string]: unknown;
};

// ── POST /v1/auth/register ────────────────────────────────────────────────────

authRouter.post('/register', async (req: Request, res: Response) => {
  const schema = z.object({
    email:     z.string().email(),
    password:  z.string().min(8),
    firstName: z.string().min(1),
    lastName:  z.string().min(1),
    phone:     z.string().optional(),
  });

  const body = schema.parse(req.body);
  const db   = getDb();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
  if (existing.length > 0) throw new ConflictError('Email already registered');

  // Password stored in dedicated column — never in metadata JSONB
  const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
  const otp          = generateOtp();
  const id           = generateId('usr');

  // OTP is still in metadata (short-lived, not sensitive credential)
  const meta: OtpMeta = {
    otpHash:      hashOtp(otp),
    otpExpiresAt: Date.now() + 10 * 60 * 1000,  // 10 min
  };

  await db.insert(users).values({
    id,
    email:        body.email,
    phone:        body.phone ?? null,
    firstName:    body.firstName,
    lastName:     body.lastName,
    passwordHash: passwordHash,  // dedicated column — not metadata
    isVerified:   false,
    isActive:     false,
    metadata:     meta,
  } as any);

  // Set identity state to PENDING with 30-min TTL
  await claimIdentity(id);

  await publishEvent(KAFKA_TOPICS.NOTIFICATION_SEND_OTP, {
    eventType: KAFKA_TOPICS.NOTIFICATION_SEND_OTP,
    payload: { userId: id, email: body.email, firstName: body.firstName, otp },
  });

  res.status(201).json({
    success: true,
    data:    { userId: id, message: 'OTP sent to email. Verify within 10 minutes.' },
  });
});

// ── POST /v1/auth/verify-otp ──────────────────────────────────────────────────

authRouter.post('/verify-otp', async (req: Request, res: Response) => {
  const schema = z.object({ userId: z.string(), otp: z.string().length(6) });
  const { userId, otp } = schema.parse(req.body);
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError('User not found');

  const meta = (user.metadata ?? {}) as OtpMeta;
  if (!meta.otpHash || !meta.otpExpiresAt) {
    return res.status(400).json({ success: false, error: 'NO_PENDING_OTP', message: 'No pending OTP for this user' });
  }
  if (Date.now() > meta.otpExpiresAt) {
    return res.status(400).json({ success: false, error: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' });
  }
  if (hashOtp(otp) !== meta.otpHash) {
    return res.status(401).json({ success: false, error: 'INVALID_OTP', message: 'Incorrect OTP' });
  }

  // Clear OTP from metadata after successful verify
  await db.update(users).set({
    isVerified: true,
    metadata:   { ...meta, otpHash: null, otpExpiresAt: null },
    updatedAt:  new Date(),
  } as any).where(eq(users.id, userId));

  // Transition identity state: PENDING → VERIFIED (7-day window to complete profile)
  await transitionUser(userId, 'verified', 'user', { reason: 'OTP verified' });

  res.json({ success: true, data: { message: 'Email verified. Complete your profile to activate.' } });
});

// ── POST /v1/auth/login ───────────────────────────────────────────────────────

authRouter.post('/login', async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email(), password: z.string() });
  const { email, password } = schema.parse(req.body);
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Constant-time comparison even when user not found
  const hash         = (user as any)?.passwordHash ?? '$2b$12$invalidhashfortiming000000000000000';
  const passwordOk   = await bcrypt.compare(password, hash);

  if (!user || !passwordOk) {
    return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Email or password incorrect' });
  }

  const identityStatus = (user as any).identityStatus ?? 'pending';
  if (identityStatus === 'suspended') {
    return res.status(403).json({ success: false, error: 'ACCOUNT_SUSPENDED', message: 'Account suspended. Contact support.' });
  }
  if (identityStatus === 'archived') {
    return res.status(403).json({ success: false, error: 'ACCOUNT_ARCHIVED', message: 'Account no longer active.' });
  }

  // First login after verification → transition VERIFIED → ACTIVE
  if (identityStatus === 'verified') {
    await transitionUser(user.id, 'active', 'system', { reason: 'First login after verification' });
  }

  await publishEvent(KAFKA_TOPICS.USER_LOGGED_IN, {
    eventType: KAFKA_TOPICS.USER_LOGGED_IN,
    payload: { userId: user.id, email: user.email },
  }).catch(() => {});

  res.json({
    success: true,
    data: {
      accessToken:  signAccess(user.id),
      refreshToken: signRefresh(user.id),
      tokenType:    'Bearer',
      expiresIn:    900,
      user: {
        id:             user.id,
        email:          user.email,
        firstName:      user.firstName,
        lastName:       user.lastName,
        identityStatus: identityStatus,
      },
    },
  });
});

// ── POST /v1/auth/refresh ─────────────────────────────────────────────────────

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const schema = z.object({ refreshToken: z.string() });
  const { refreshToken } = schema.parse(req.body);

  let payload: { sub: string };
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET!) as { sub: string };
  } catch {
    return res.status(401).json({ success: false, error: 'INVALID_REFRESH_TOKEN', message: 'Refresh token invalid or expired' });
  }

  res.json({
    success: true,
    data: {
      accessToken: signAccess(payload.sub),
      tokenType:   'Bearer',
      expiresIn:   900,
    },
  });
});

// ── POST /v1/auth/logout ──────────────────────────────────────────────────────

authRouter.post('/logout', (_req: Request, res: Response) => {
  // Stateless JWT — client drops tokens. Refresh token blocklist handled via Redis in M4+.
  res.json({ success: true, data: { message: 'Logged out' } });
});

// ── POST /v1/auth/link-identity ───────────────────────────────────────────────
// Link BVN or NIN — stored as HMAC-SHA256 (not plain SHA-256)

authRouter.post('/link-identity', async (req: Request, res: Response) => {
  const schema = z.object({
    userId: z.string(),
    type:   z.enum(['bvn', 'nin']),
    value:  z.string().min(10),
  });
  const { userId, type, value } = schema.parse(req.body);
  const db = getDb();

  const hash = hmacHash(value);  // HMAC-SHA256 with IDENTITY_HMAC_SECRET
  const update = type === 'bvn'
    ? { bvnHash: hash, updatedAt: new Date() }
    : { ninHash: hash, updatedAt: new Date() };

  await db.update(users).set(update as any).where(eq(users.id, userId));

  res.json({ success: true, data: { message: `${type.toUpperCase()} linked successfully` } });
});

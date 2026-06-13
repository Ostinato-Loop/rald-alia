// POST /v1/machine/auth — issue machine JWT
// Called by internal ALIA services and RALD product services on startup.
// Returns a 24h machine JWT. Service auto-rotates before expiry.

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@rald-alia/db';
import { machineIdentities, machineJwtLog } from '@rald-alia/db';
import { signMachineJwt } from '@rald-alia/shared/machineJwt';

export const machineRouter = Router();
const db = getDb();

const MachineAuthSchema = z.object({
  service_name:  z.string().min(1),
  client_secret: z.string().min(16),
});

// POST /v1/machine/auth
machineRouter.post('/machine/auth', async (req: Request, res: Response) => {
  const parsed = MachineAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      success: false,
      error:   'VALIDATION_ERROR',
      message: 'service_name and client_secret required',
    });
    return;
  }

  const { service_name, client_secret } = parsed.data;

  // Fetch machine identity
  const [machine] = await db
    .select()
    .from(machineIdentities)
    .where(
      and(
        eq(machineIdentities.serviceName, service_name),
        eq(machineIdentities.isActive, true),
      ),
    )
    .limit(1);

  if (!machine) {
    // Constant-time non-response to avoid enumeration
    await bcrypt.compare(client_secret, '$2b$12$invalidhashfortimingnormalization00');
    res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Authentication failed' });
    return;
  }

  const valid = await bcrypt.compare(client_secret, machine.clientSecretHash);
  if (!valid) {
    res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Authentication failed' });
    return;
  }

  // Issue machine JWT
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const token = signMachineJwt({
    sub:              machine.id,
    type:             'machine',
    service_name:     machine.serviceName,
    allowed_scopes:   machine.allowedScopes as string[],
    allowed_services: machine.allowedServices as string[],
    environment:      machine.environment,
  });

  // Log issuance
  const logId = uuidv4();
  await db.insert(machineJwtLog).values({
    id:          logId,
    machineId:   machine.id,
    serviceName: machine.serviceName,
    expiresAt,
    ipAddress:   req.ip ?? null,
  });

  // Update last_auth_at and auth_count
  await db
    .update(machineIdentities)
    .set({
      lastAuthAt:  new Date(),
      lastAuthIp:  req.ip ?? null,
      authCount:   machine.authCount + BigInt(1),
      updatedAt:   new Date(),
    })
    .where(eq(machineIdentities.id, machine.id));

  res.json({
    success: true,
    data: {
      token,
      token_type:       'Bearer',
      expires_at:       expiresAt.toISOString(),
      expires_in:       86400,
      service_name:     machine.serviceName,
      allowed_scopes:   machine.allowedScopes,
      rotate_before:    new Date(expiresAt.getTime() - 60 * 60 * 1000).toISOString(),  // rotate 1h before expiry
    },
  });
});

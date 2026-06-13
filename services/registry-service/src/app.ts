import express from 'express';
import { tightHelmet, internalCors, createRateLimiter, RateTier } from '@rald-alia/shared/security';
import { pinoHttp } from 'pino-http';
import { logger } from './index';
import { registryRouter } from './routes/registry.routes';
import { requireAuth } from './middleware/auth.middleware';

export const app = express();

app.use(tightHelmet());
app.use(internalCors());
app.use(express.json());
app.use(pinoHttp({ logger }));

// Health check — no auth required
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'registry-service', ts: new Date().toISOString() });
});

// Registry API — all routes require auth
// Internal services call with machine JWT; admin console calls with admin JWT
app.use('/v1/registry', requireAuth, registryRouter);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status  = err.status ?? 500;
  const message = err.message ?? 'Internal server error';
  if (status >= 500) logger.error({ err }, 'Unhandled error');
  res.status(status).json({
    success: false,
    error:   status === 500 ? 'INTERNAL_ERROR' : (err.code ?? 'ERROR'),
    message,
    ...(err.details ? { details: err.details } : {}),
  });
});

// services/resolution-engine/src/app.ts
import express from 'express';
import { tightHelmet, internalCors, createRateLimiter, RateTier } from '@rald-alia/shared/security';
import { pinoHttp } from 'pino-http';
import { requestIdMiddleware } from '@rald-alia/shared/requestId';
import { logger } from './index';

export const app = express();

app.use(tightHelmet());
app.use(internalCors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(pinoHttp({ logger }));
app.use(createRateLimiter(RateTier.MACHINE));

app.get('/healthz', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'resolution-engine',
    version:   '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Routes will be added as the service is implemented
// app.use('/v1', router);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status  = err.status  ?? 500;
  const code    = err.code    ?? 'INTERNAL_ERROR';
  const message = status < 500 ? err.message : 'An unexpected error occurred';
  if (status >= 500) logger.error({ err }, 'Unhandled error');
  res.status(status).json({ success: false, error: { code, message } });
});

// services/control-plane/src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { router } from './routes';
import { requestIdMiddleware } from '@rald-alia/shared/requestId';
import { logger } from './index';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(pinoHttp({ logger }));

// Stricter rate limit — this is a privileged admin plane
app.use(rateLimit({
  windowMs:        60_000,
  max:             120,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Slow down' } },
}));

// Public health check — no auth (used by load balancer)
app.get('/healthz', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'control-plane',
    version:   '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/v1', router);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status  = err.status  ?? 500;
  const code    = err.code    ?? 'INTERNAL_ERROR';
  const message = status < 500 ? err.message : 'An unexpected error occurred';
  if (status >= 500) logger.error({ err }, 'Unhandled error');
  res.status(status).json({ success: false, error: { code, message } });
});

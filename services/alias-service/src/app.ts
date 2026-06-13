import express from 'express';
import { tightHelmet, internalCors, createRateLimiter, RateTier } from '@rald-alia/shared/security';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(tightHelmet());
app.use(internalCors());
app.use(express.json({ limit: '1mb' }));

app.use(createRateLimiter(RateTier.HIGH));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'alias-service', timestamp: new Date().toISOString() });
});

app.use('/v1', router);
app.use(errorHandler);

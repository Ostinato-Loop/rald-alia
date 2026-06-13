import express from 'express';
import { tightHelmet, internalCors, createRateLimiter, RateTier } from '@rald-alia/shared/security';
import { errorHandler } from './middleware/errorHandler';

export const app = express();
app.use(tightHelmet());
app.use(internalCors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

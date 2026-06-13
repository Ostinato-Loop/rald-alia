import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'alias-service', timestamp: new Date().toISOString() });
});

app.use('/v1', router);
app.use(errorHandler);

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'audit-service', timestamp: new Date().toISOString() });
});

app.use('/v1', router);
app.use(errorHandler);

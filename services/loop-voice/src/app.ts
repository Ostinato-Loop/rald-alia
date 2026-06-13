import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import rateLimit from 'express-rate-limit';
import { voiceRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(helmet());
app.use(pinoHttp({ level: process.env['LOG_LEVEL'] ?? 'info' }));
app.use(express.json({ limit: '50mb' }));

app.use('/v1/voice/transcribe', rateLimit({ windowMs: 60_000, max: 100 }));
app.use('/v1/voice/synthesize', rateLimit({ windowMs: 60_000, max: 200 }));

app.get('/health', (_req, res) => res.json({
  ok: true, service: 'loop-voice', version: '1.0.0',
  languages: 14,
  capabilities: ['transcription', 'synthesis', 'intent_extraction', 'dialect_detection', 'speech_collection'],
}));

app.use('/v1/voice', voiceRouter);
app.use(errorHandler as express.ErrorRequestHandler);

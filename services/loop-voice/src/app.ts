import express from 'express';
import { tightHelmet, createRateLimiter, RateTier } from '@rald-alia/shared/security';
import { pinoHttp } from 'pino-http';
import { voiceRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

// loop-voice is called by telecom/USSD infrastructure — no browser CORS needed
app.use(tightHelmet());
app.use(pinoHttp({ level: process.env['LOG_LEVEL'] ?? 'info' }));
app.use(express.json({ limit: '50mb' }));

// Per-route rate limits: transcription is compute-heavy, synthesis is lighter
app.use('/v1/voice/transcribe', createRateLimiter(RateTier.STANDARD));
app.use('/v1/voice/synthesize', createRateLimiter(RateTier.HIGH));

app.get('/health', (_req, res) => res.json({
  ok: true, service: 'loop-voice', version: '1.0.0',
  languages: 14,
  capabilities: ['transcription', 'synthesis', 'intent_extraction', 'dialect_detection', 'speech_collection'],
}));

app.use('/v1/voice', voiceRouter);
app.use(errorHandler as express.ErrorRequestHandler);

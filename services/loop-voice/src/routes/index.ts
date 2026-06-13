import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireMachineScope } from '../middleware/machineAuth';
import { transcribe, synthesize, createCollectionSession } from '../services/voice.service';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

const TranscribeSchema = z.object({
  audio_url:    z.string().url().optional(),
  audio_base64: z.string().optional(),
  format:       z.enum(['mp3', 'wav', 'ogg', 'm4a', 'webm']),
  language:     z.string().optional(),
  region:       z.string().optional(),
  intent_mode:  z.boolean().default(false),
}).refine(d => d.audio_url ?? d.audio_base64, { message: 'audio_url or audio_base64 required' });

router.post('/transcribe',
  requireMachineScope('voice:transcribe'),
  asyncHandler(async (req, res) => {
    const data   = TranscribeSchema.parse(req.body);
    const result = await transcribe(data as Parameters<typeof transcribe>[0]);
    res.json({ success: true, data: result });
  })
);

const SynthesizeSchema = z.object({
  text:     z.string().min(1).max(4096),
  language: z.string().default('en'),
  voice_id: z.string().optional(),
  speed:    z.number().min(0.5).max(2.0).default(1.0),
  emotion:  z.enum(['neutral', 'friendly', 'professional']).default('neutral'),
});

router.post('/synthesize',
  requireMachineScope('voice:synthesize'),
  asyncHandler(async (req, res) => {
    const data   = SynthesizeSchema.parse(req.body);
    const result = await synthesize(data as Parameters<typeof synthesize>[0]);
    res.json({ success: true, data: result });
  })
);

router.post('/intent',
  requireMachineScope('voice:transcribe'),
  asyncHandler(async (req, res) => {
    const data   = TranscribeSchema.parse({ ...req.body, intent_mode: true });
    const result = await transcribe(data as Parameters<typeof transcribe>[0]);
    res.json({ success: true, data: {
      transcript: result.transcript,
      language:   result.language,
      dialect:    result.dialect ?? null,
      intent:     result.intent ?? null,
    }});
  })
);

const CollectSchema = z.object({
  language:       z.string(),
  region:         z.string(),
  contributor_id: z.string(),
});

router.post('/collect',
  requireMachineScope('voice:collect'),
  asyncHandler(async (req, res) => {
    const { language, region, contributor_id } = CollectSchema.parse(req.body);
    const session = createCollectionSession(language, region as Parameters<typeof createCollectionSession>[1], contributor_id);
    res.status(201).json({ success: true, data: session });
  })
);

router.get('/languages', (_req, res) => {
  res.json({ success: true, data: {
    languages: [
      { code: 'en',  name: 'English',         regions: ['NG','GH','KE','ZA'] },
      { code: 'yo',  name: 'Yoruba',           regions: ['NG'] },
      { code: 'ha',  name: 'Hausa',            regions: ['NG'] },
      { code: 'ig',  name: 'Igbo',             regions: ['NG'] },
      { code: 'pcm', name: 'Nigerian Pidgin',  regions: ['NG'] },
      { code: 'sw',  name: 'Swahili',          regions: ['KE','TZ'] },
      { code: 'fr',  name: 'French',           regions: ['SN','ET'] },
      { code: 'wo',  name: 'Wolof',            regions: ['SN'] },
      { code: 'zu',  name: 'Zulu',             regions: ['ZA'] },
      { code: 'xh',  name: 'Xhosa',            regions: ['ZA'] },
      { code: 'af',  name: 'Afrikaans',        regions: ['ZA'] },
      { code: 'am',  name: 'Amharic',          regions: ['ET'] },
      { code: 'so',  name: 'Somali',           regions: ['ET'] },
      { code: 'ar',  name: 'Arabic (African)', regions: ['EG'] },
    ],
    capabilities: ['transcription', 'synthesis', 'intent_extraction', 'dialect_detection', 'speech_collection'],
  }});
});

export { router as voiceRouter };

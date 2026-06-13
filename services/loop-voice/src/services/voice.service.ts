import { v4 as uuidv4 } from 'uuid';
import type {
  TranscriptionRequest, TranscriptionResult,
  SynthesisRequest, SynthesisResult,
  CollectionSession, SupportedLanguage, SupportedRegion,
} from '../types';

const OPENAI_KEY = process.env['OPENAI_API_KEY'] ?? '';

const DIALECT_HINTS: Record<string, string[]> = {
  yo:  ['jẹ', 'pẹ', 'ọ', 'ẹ', 'ṣ', 'ẹni', 'tó'],
  ha:  ['Allah', 'insha', 'mana', 'don', 'zuwa'],
  ig:  ['nna', 'chineke', 'ọ bụ', 'ya ga'],
  pcm: ['abeg', 'wetin', 'na', 'oga', 'wahala', 'no be'],
  sw:  ['habari', 'sawa', 'karibu'],
  wo:  ['waaw', 'dégg', 'jëf'],
};

function detectDialect(transcript: string, lang: SupportedLanguage): string | undefined {
  const lower = transcript.toLowerCase();
  if (lang === 'pcm') {
    if (/naija|9ja/.test(lower))   return 'Nigerian Pidgin (Naija)';
    if (/kine thing/.test(lower))  return 'Cameroonian Pidgin';
  }
  if (lang === 'sw' && /sheng|manze|si poa/.test(lower)) return 'Nairobi Sheng';
  if (lang === 'en') {
    if ((DIALECT_HINTS['pcm'] ?? []).some(h => lower.includes(h))) return 'Pidgin-inflected English';
    if ((DIALECT_HINTS['yo']  ?? []).some(h => lower.includes(h))) return 'Yoruba-inflected English';
  }
  return undefined;
}

const INTENT_PATTERNS: Array<{
  pattern: RegExp;
  type: string;
  extractor: (m: RegExpMatchArray) => Record<string, unknown>;
}> = [
  {
    pattern: /(?:send|transfer|pay)\s+(?:(\d+[k]?|\w+)\s+(?:naira|cedis|shillings|rand|cfa)?\s+)?(?:to|give)?\s+(\w+)/i,
    type: 'transfer_money',
    extractor: m => ({ amount: m[1] ?? null, recipient: m[2] ?? null }),
  },
  {
    pattern: /(?:check|what(?:'s| is) my)\s+(?:account|wallet)?\s*balance/i,
    type: 'check_balance',
    extractor: () => ({}),
  },
  {
    pattern: /(?:pay|settle)\s+(?:my\s+)?(?:bill|invoice|debt)/i,
    type: 'pay_bill',
    extractor: () => ({}),
  },
  {
    pattern: /(?:book|reserve|order)\s+(?:a\s+)?(?:truck|vehicle|transport)/i,
    type: 'book_logistics',
    extractor: () => ({}),
  },
];

function extractIntent(transcript: string) {
  for (const ip of INTENT_PATTERNS) {
    const m = transcript.match(ip.pattern);
    if (m) return { type: ip.type, confidence: 0.85, entities: ip.extractor(m), raw_input: transcript };
  }
  return null;
}

export async function transcribe(req: TranscriptionRequest): Promise<TranscriptionResult> {
  if (!OPENAI_KEY) throw Object.assign(new Error('OPENAI_API_KEY not configured'), { status: 503 });

  const form = new FormData();
  if (req.audio_url) {
    const audioRes = await fetch(req.audio_url);
    if (!audioRes.ok) throw Object.assign(new Error('Failed to fetch audio URL'), { status: 400 });
    form.append('file', await audioRes.blob(), `audio.${req.format}`);
  } else if (req.audio_base64) {
    const buf = Buffer.from(req.audio_base64, 'base64');
    form.append('file', new Blob([buf]), `audio.${req.format}`);
  } else {
    throw Object.assign(new Error('audio_url or audio_base64 required'), { status: 400 });
  }

  form.append('model', 'whisper-1');
  if (req.language) form.append('language', req.language);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body:    form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw Object.assign(new Error(`Whisper API error: ${err.slice(0, 200)}`), { status: res.status });
  }

  const data = await res.json() as Record<string, unknown>;
  const lang = (req.language ?? data['language'] ?? 'en') as SupportedLanguage;
  const transcript = data['text'] as string;

  return {
    transcript,
    language:   lang,
    confidence: 0.92,
    dialect:    detectDialect(transcript, lang),
    words:      ((data['words'] ?? []) as Array<Record<string, unknown>>).map(w => ({
      word: w['word'] as string, start: w['start'] as number,
      end:  w['end']  as number, confidence: (w['probability'] as number) ?? 0.9,
    })),
    intent: req.intent_mode ? extractIntent(transcript) : null,
  };
}

export async function synthesize(req: SynthesisRequest): Promise<SynthesisResult> {
  if (!OPENAI_KEY) throw Object.assign(new Error('OPENAI_API_KEY not configured'), { status: 503 });

  const voiceMap: Record<string, string> = {
    neutral: 'alloy', friendly: 'nova', professional: 'onyx',
  };
  const voice = req.voice_id ?? voiceMap[req.emotion ?? 'neutral'] ?? 'alloy';

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method:  'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: 'tts-1-hd', input: req.text, voice, speed: req.speed ?? 1.0 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw Object.assign(new Error(`TTS API error: ${err.slice(0, 200)}`), { status: res.status });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return {
    audio_url:   `data:audio/mpeg;base64,${buf.toString('base64')}`,
    duration_ms: Math.ceil(req.text.split(' ').length * 400),
    format:      'mp3',
    language:    req.language,
  };
}

const PROMPTS: Record<string, string[]> = {
  pcm: ['Abeg send 5000 naira give my mama', 'Wetin be the balance for my account?'],
  yo:  ['Jọwọ fi owo ranṣẹ si mama mi', 'Kini iye owo ti mo ni ninu iroyin mi?'],
  ha:  ['Don Allah aika kuɗi zuwa ga mahaifiyata', 'Nawa ne sauran kuɗina?'],
  sw:  ['Tuma shilingi elfu kumi kwa mama yangu', 'Niambie salio la akaunti yangu'],
  en:  ['Please send 5000 to my mother', 'What is my account balance?'],
};

export function createCollectionSession(
  language: string,
  region: SupportedRegion,
  contributorId: string,
): CollectionSession {
  const prompts = PROMPTS[language] ?? PROMPTS['pcm']!;
  const prompt  = prompts[Math.floor(Math.random() * prompts.length)]!;
  const id      = uuidv4();
  return {
    id,
    prompt,
    language:       language as SupportedLanguage,
    region,
    contributor_id: contributorId,
    expires_at:     new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    upload_url:     `https://voice.rald.cloud/upload/${id}`,
  };
}

export type SupportedLanguage =
  | 'en' | 'yo' | 'ha' | 'ig' | 'pcm'
  | 'sw' | 'sn'
  | 'fr' | 'wo'
  | 'zu' | 'xh' | 'af'
  | 'am' | 'so'
  | 'ar';

export type SupportedRegion =
  | 'NG' | 'GH' | 'KE' | 'ZA' | 'ET' | 'TZ' | 'SN' | 'EG';

export interface TranscriptionRequest {
  audio_url?:    string;
  audio_base64?: string;
  format:        'mp3' | 'wav' | 'ogg' | 'm4a' | 'webm';
  language?:     SupportedLanguage;
  region?:       SupportedRegion;
  intent_mode?:  boolean;
}

export interface TranscriptionResult {
  transcript:  string;
  language:    SupportedLanguage;
  confidence:  number;
  dialect?:    string;
  words?:      Array<{ word: string; start: number; end: number; confidence: number }>;
  intent?:     SpeechIntent | null;
}

export interface SpeechIntent {
  type:       string;
  confidence: number;
  entities:   Record<string, string | number | boolean>;
  raw_input:  string;
}

export interface SynthesisRequest {
  text:      string;
  language:  SupportedLanguage;
  voice_id?: string;
  speed?:    number;
  emotion?:  'neutral' | 'friendly' | 'professional';
}

export interface SynthesisResult {
  audio_url:   string;
  duration_ms: number;
  format:      'mp3';
  language:    SupportedLanguage;
}

export interface CollectionSession {
  id:             string;
  prompt:         string;
  language:       SupportedLanguage;
  region:         SupportedRegion;
  contributor_id: string;
  expires_at:     string;
  upload_url:     string;
}

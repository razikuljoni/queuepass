// Shared types + pure helpers for QueuePass (no I/O, no secrets).
export type Locale = 'bn' | 'en';
export type TokenStatus = 'waiting' | 'called' | 'serving' | 'completed' | 'no_show' | 'cancelled' | 'expired';
export type Priority = 'normal' | 'priority';
export type TokenSource = 'qr' | 'sms' | 'kiosk' | 'staff' | 'appointment';
export type Role = 'owner' | 'branch_manager' | 'counter' | 'viewer';
export type CounterStatus = 'open' | 'break' | 'closed';
export type SmsEvent = 'joined' | 'three_away' | 'your_turn' | 'recalled';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface EtaInput { peopleAhead: number; avgServiceMin: number; countersOpen: number; }
export function estimateWaitMin({ peopleAhead, avgServiceMin, countersOpen }: EtaInput): number {
  if (peopleAhead <= 0) return 0;
  const open = Math.max(1, countersOpen);
  return Math.ceil((peopleAhead * Math.max(1, avgServiceMin)) / open);
}
/** Display a range, never false precision: "10–15 min". */
export function etaRange(min: number): { low: number; high: number } {
  if (min <= 0) return { low: 0, high: 0 };
  const low = Math.max(1, Math.round(min * 0.8));
  return { low, high: Math.max(low + 1, Math.round(min * 1.25)) };
}
/** EWMA smoothing for rolling average service time (minutes). */
export function ewma(prev: number, sample: number, alpha = 0.35): number {
  return Math.round((alpha * sample + (1 - alpha) * prev) * 10) / 10;
}

/** SMS copy. Bangla must stay <= 70 chars (1 segment); English <= 160. */
export const SMS_TEMPLATES: Record<SmsEvent, { bn: string; en: string }> = {
  joined: {
    bn: 'QueuePass: টোকেন {token}, {service}। আপনার আগে {ahead} জন। লিংক: {link}',
    en: 'QueuePass: Token {token}, {service}. {ahead} ahead of you. Link: {link}',
  },
  three_away: {
    bn: 'QueuePass: {token} — আপনার আগে ৩ জন। অনুগ্রহ করে ফিরে আসুন।',
    en: 'QueuePass: {token} — 3 people ahead. Please return now.',
  },
  your_turn: {
    bn: 'QueuePass: {token} — আপনার পালা! কাউন্টার {counter}-এ আসুন।',
    en: 'QueuePass: {token} — your turn! Please come to Counter {counter}.',
  },
  recalled: {
    bn: 'QueuePass: {token} আবার ডাকা হয়েছে। কাউন্টার {counter}-এ আসুন।',
    en: 'QueuePass: {token} called again. Please come to Counter {counter}.',
  },
};
export function renderSms(event: SmsEvent, locale: Locale, vars: Record<string, string | number>): string {
  let s = SMS_TEMPLATES[event][locale];
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
/** Bangla (Unicode) SMS segments: ~70 chars/segment. English: 160. */
export function smsSegments(text: string): number {
  const isUnicode = /[^ -~]/.test(text); // any char outside printable ASCII
  const per = isUnicode ? 70 : 160;
  return Math.max(1, Math.ceil(text.length / per));
}

export const BOARD = {
  paper: '#F7F5F0', ink: '#141412', muted: '#6B6862', border: '#E5E0D6',
  amber: '#D97706', green: '#1E7B4D', red: '#C0392B',
} as const;

export const PRIORITY_FAIRNESS = { maxPriorityPerRegular: 1, regularPerPriority: 3 };
export const RATE_LIMIT = { maxTokensPerPhonePerDayPerBranch: 3, joinCooldownSeconds: 30 };
export const NO_SHOW = { maxRecalls: 2, graceMinutes: 3, maxRequeues: 1 };

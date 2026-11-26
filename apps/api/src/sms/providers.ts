import { smsSegments } from '@queuepass/shared';
import { SmsProvider, SmsSendResult } from './sms-provider.interface';

/** Dev provider: logs to console, marks sent. No real SMS without credentials. */
export class DevSmsProvider implements SmsProvider {
  readonly name = 'dev';
  async send(to: string, body: string, opts: { masking: boolean }): Promise<SmsSendResult> {
    const cost = smsSegments(body) * (opts.masking ? Number(process.env.SMS_COST_MASKING_BDT ?? 0.55) : Number(process.env.SMS_COST_NON_MASKING_BDT ?? 0.35));
    console.log(`[sms:dev] to=${to} masking=${opts.masking} segments=${smsSegments(body)} body=${body}`);
    return { providerMsgId: `dev-${Date.now()}`, costBdt: Math.round(cost * 100) / 100 };
  }
  async balance(): Promise<number | null> { return null; }
}

/** Provider that always fails — used by tests to prove the outbox survives a dead gateway. */
export class FailingSmsProvider implements SmsProvider {
  readonly name = 'fail';
  async send(): Promise<SmsSendResult> { throw new Error('SMS gateway unavailable (simulated)'); }
  async balance(): Promise<number | null> { return null; }
}

/**
 * BulkSMSBD (BTRC-enlisted aggregator). API: POST https://api.bulksmsbd.com/api/sms
 * with api_key + sender_id + to + message. Docs: bulksmsbd.com.
 * No credentials in code — env vars only.
 */
export class BulkSmsBdProvider implements SmsProvider {
  readonly name = 'bulksmsbd';
  async send(to: string, body: string, opts: { masking: boolean }): Promise<SmsSendResult> {
    const apiKey = process.env.BULKSMSBD_API_KEY;
    const senderId = process.env.BULKSMSBD_SENDER_ID || process.env.SMS_SENDER_ID || 'QUEUEPASS';
    if (!apiKey) throw new Error('BULKSMSBD_API_KEY not configured');
    const res = await fetch('https://api.bulksmsbd.com/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, sender_id: senderId, to, message: body, type: opts.masking ? 'masking' : 'non-masking' }),
    });
    if (!res.ok) throw new Error(`BulkSMSBD HTTP ${res.status}`);
    const json = (await res.json()) as { message_id?: string; status?: string };
    const cost = smsSegments(body) * (opts.masking ? Number(process.env.SMS_COST_MASKING_BDT ?? 0.55) : Number(process.env.SMS_COST_NON_MASKING_BDT ?? 0.35));
    return { providerMsgId: json.message_id, costBdt: Math.round(cost * 100) / 100 };
  }
  async balance(): Promise<number | null> { return null; }
}

/**
 * GreenWeb (bdbulksms.net). API: GET/POST https://api.greenweb.com.bd/api.php
 * with token + to + message (+ masking sender id when approved).
 */
export class GreenWebProvider implements SmsProvider {
  readonly name = 'greenweb';
  async send(to: string, body: string, opts: { masking: boolean }): Promise<SmsSendResult> {
    const token = process.env.GREENWEB_API_TOKEN;
    if (!token) throw new Error('GREENWEB_API_TOKEN not configured');
    const params = new URLSearchParams({
      token,
      to,
      message: body,
      ...(opts.masking && process.env.GREENWEB_SENDER_ID ? { sender_id: process.env.GREENWEB_SENDER_ID } : {}),
    });
    const res = await fetch(`https://api.greenweb.com.bd/api.php?${params.toString()}`);
    if (!res.ok) throw new Error(`GreenWeb HTTP ${res.status}`);
    const text = await res.text();
    const cost = smsSegments(body) * (opts.masking ? Number(process.env.SMS_COST_MASKING_BDT ?? 0.55) : Number(process.env.SMS_COST_NON_MASKING_BDT ?? 0.35));
    return { providerMsgId: text.slice(0, 64), costBdt: Math.round(cost * 100) / 100 };
  }
  async balance(): Promise<number | null> { return null; }
}

export function smsProviderFromEnv(): SmsProvider {
  switch ((process.env.SMS_PROVIDER || 'dev').toLowerCase()) {
    case 'bulksmsbd': return new BulkSmsBdProvider();
    case 'greenweb': return new GreenWebProvider();
    case 'fail': return new FailingSmsProvider();
    default: return new DevSmsProvider();
  }
}

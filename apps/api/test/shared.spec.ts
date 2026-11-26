import { estimateWaitMin, etaRange, ewma, smsSegments, renderSms } from '@queuepass/shared';
import { fairOrder } from '../src/tokens/eta.service';

describe('shared pure functions', () => {
  it('estimateWaitMin divides ahead by open counters', () => {
    expect(estimateWaitMin({ peopleAhead: 6, avgServiceMin: 8, countersOpen: 2 })).toBe(24);
    expect(estimateWaitMin({ peopleAhead: 0, avgServiceMin: 8, countersOpen: 2 })).toBe(0);
    expect(estimateWaitMin({ peopleAhead: 3, avgServiceMin: 8, countersOpen: 0 })).toBe(24); // no counters open: single lane
  });
  it('etaRange brackets the estimate', () => {
    const { low, high } = etaRange(12);
    expect(low).toBeLessThanOrEqual(12);
    expect(high).toBeGreaterThanOrEqual(12);
    expect(etaRange(0)).toEqual({ low: 0, high: 0 });
  });
  it('ewma smooths service times', () => {
    expect(ewma(10, 20, 0.3)).toBeCloseTo(13);
    expect(ewma(10, 20, 1)).toBe(20);
  });
  it('smsSegments counts Bangla at ~70 chars and English at 160', () => {
    expect(smsSegments('hello')).toBe(1);
    expect(smsSegments('a'.repeat(161))).toBe(2);
    expect(smsSegments('আ'.repeat(71))).toBe(2);
  });
  it('renderSms fills templates in both locales', () => {
    const bn = renderSms('joined', 'bn', { token: 'A-027', link: 'http://x/t/abc' });
    expect(bn).toContain('A-027');
    const en = renderSms('your_turn', 'en', { token: 'A-027', counter: 'Counter 2' });
    expect(en).toContain('Counter 2');
  });
  it('fairOrder caps priority at 1 per 3 regular', () => {
    const mk = (id: string, priority: 'normal' | 'priority', i: number) => ({ id, priority, createdAt: new Date(1000 + i) });
    const rows = [
      mk('p1', 'priority', 0), mk('r1', 'normal', 1), mk('r2', 'normal', 2),
      mk('r3', 'normal', 3), mk('p2', 'priority', 4), mk('r4', 'normal', 5),
    ];
    const out = fairOrder(rows);
    // Up to 3 earlier regulars go before a priority token; priority never starves regulars.
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'p1', 'r4', 'p2']);
  });
});

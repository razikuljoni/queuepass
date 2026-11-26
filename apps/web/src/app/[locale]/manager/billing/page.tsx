'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

type Tier = { id: string; name: string; priceBdt?: number | null; note?: string };
type Me = { plan: string; smsBalanceBdt: number };

export default function BillingPage() {
  const tc = useTranslations('common');
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [amount, setAmount] = useState('1000');
  const [method, setMethod] = useState('bKash');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<Tier[]>('/billing/tiers').then(setTiers).catch(() => {});
    api<Me>('/billing/me', { auth: true }).then(setMe).catch((e) => setError((e as Error).message));
  }, []);

  const topup = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMsg('');
    try {
      const r = await api<{ smsBalanceBdt: number; status: string }>('/billing/sms-topup', {
        method: 'POST', auth: true,
        body: { amountBdt: Number(amount), method, reference: reference || undefined },
      });
      setMe((m) => (m ? { ...m, smsBalanceBdt: r.smsBalanceBdt } : m));
      setMsg(r.status);
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <>
      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}
      {me && (
        <div className="grid grid-2">
          <div className="card stat"><div className="label">Current plan</div><div className="value">{me.plan}</div></div>
          <div className="card stat"><div className="label">SMS balance</div><div className="value">৳{me.smsBalanceBdt}</div></div>
        </div>
      )}
      <h2>Plans</h2>
      <div className="grid grid-3">
        {tiers.map((tier) => (
          <div key={tier.id} className="card">
            <h3 style={{ marginTop: 0 }}>{tier.name}</h3>
            <p style={{ fontSize: 22, fontWeight: 800 }}>{tier.priceBdt == null ? 'Pricing TBD' : `৳${tier.priceBdt}/mo`}</p>
            {tier.note && <p className="small muted">{tier.note}</p>}
          </div>
        ))}
        {tiers.length === 0 && <p className="muted">Plan pricing is not set yet — the pilot is free while pricing is decided.</p>}
      </div>
      <h2>SMS top-up (record a payment)</h2>
      <p className="small muted">No real money moves here yet — this records a top-up after you pay by bKash / Nagad / bank transfer. Merchant accounts are still being set up.</p>
      <form onSubmit={topup} className="card">
        <div className="grid grid-3">
          <div><label>Amount (৳)</label><input type="number" min={100} value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
          <div>
            <label>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>bKash</option><option>Nagad</option><option>Bank transfer</option>
            </select>
          </div>
          <div><label>Reference / TrxID</label><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 9HX7…" /></div>
        </div>
        <div style={{ marginTop: 16 }}><button className="btn" type="submit">{tc('save')}</button></div>
      </form>
    </>
  );
}

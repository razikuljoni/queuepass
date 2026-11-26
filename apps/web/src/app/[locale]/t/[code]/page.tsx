'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, streamUrl, type TokenView } from '@/lib/api';

export default function TokenPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const t = useTranslations('token');
  const ts = useTranslations('token.status');
  const [token, setToken] = useState<TokenView | null>(null);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => { params.then((p) => setCode(p.code)); }, [params]);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    const load = () =>
      api<TokenView>(`/public/t/${code}`)
        .then((v) => { if (alive) setToken(v); })
        .catch((e) => { if (alive) setError((e as Error).message); });
    load();
    const timer = setInterval(load, 60000); // re-sync guard if SSE drops
    return () => { alive = false; clearInterval(timer); };
  }, [code]);

  useEffect(() => {
    if (!token?.branchId || !code) return;
    const es = new EventSource(streamUrl(token.branchId));
    es.onmessage = () => api<TokenView>(`/public/t/${code}`).then(setToken).catch(() => {});
    return () => es.close();
  }, [token?.branchId, code]);

  const leave = async () => {
    if (!confirm(t('leaveConfirm'))) return;
    try {
      await api(`/public/t/${code}/leave`, { method: 'POST', body: { reason: 'left by visitor' } });
      setLeft(true);
      setToken(await api<TokenView>(`/public/t/${code}`));
    } catch (err) { setError((err as Error).message); }
  };

  if (error && !token) return <main className="wrap"><div className="error">{error}</div></main>;
  if (!token) return <main className="wrap"><p className="muted">…</p></main>;

  const pos = token.position;
  const called = token.status === 'called' || token.status === 'serving';
  return (
    <main className="wrap">
      <h1>{t('title')}</h1>
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div className={`token-no ${called ? 'amber' : token.status === 'completed' ? 'green' : ''}`}>{token.number}</div>
        <div style={{ marginTop: 8 }}><span className={`badge ${called ? 'amber' : token.status === 'completed' ? 'green' : ''}`}>{ts(token.status as never)}</span></div>
        {called && token.counterName && <p style={{ marginTop: 16, fontSize: 18 }}>{t('calledBanner', { counter: token.counterName })}</p>}
        {token.status === 'waiting' && pos && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 20, margin: 0 }}>{pos.peopleAhead === 0 ? t('youAreNext') : t('ahead', { n: pos.peopleAhead })}</p>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              {t('eta')}: <strong>{t('etaRange', { low: pos.etaLow, high: pos.etaHigh })}</strong> · {t('countersOpen', { n: pos.countersOpen })}
            </p>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 20 }}>{t('linkHint')}</p>
        {token.status === 'waiting' && !left && (
          <div style={{ marginTop: 16 }}>
            <button className="btn danger" onClick={leave}>{t('leave')}</button>
          </div>
        )}
        {left && <p className="ok">{t('left')}</p>}
      </div>
      {error && <div className="error">{error}</div>}
    </main>
  );
}

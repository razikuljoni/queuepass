'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, getUser, streamUrl, type Branch, type Counter, type TokenView } from '@/lib/api';

export default function CounterPage({ params }: { params: Promise<{ locale: string }> }) {
  const t = useTranslations('counter');
  const router = useRouter();
  const [locale, setLocale] = useState('bn');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [counters, setCounters] = useState<Counter[]>([]);
  const [counterId, setCounterId] = useState('');
  const [queue, setQueue] = useState<TokenView[]>([]);
  const [current, setCurrent] = useState<TokenView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { params.then((p) => setLocale(p.locale)); }, [params]);
  useEffect(() => {
    if (!getUser()) { router.push(`/${locale}/login`); return; }
    api<Branch[]>('/branches', { auth: true }).then((b) => { setBranches(b); if (b[0]) setBranchId(b[0].id); }).catch((e) => setError((e as Error).message));
  }, [locale, router]);

  useEffect(() => {
    if (!branchId) return;
    api<Counter[]>(`/counters?branchId=${branchId}`, { auth: true }).then(setCounters).catch(() => setCounters([]));
  }, [branchId]);

  const loadQueue = useCallback(async () => {
    if (!branchId) return;
    try {
      const q = await api<TokenView[]>(`/queue?branchId=${branchId}`, { auth: true });
      setQueue(q);
      const c = counters.find((x) => x.id === counterId);
      if (c?.currentTokenId) setCurrent(q.find((x) => x.id === c.currentTokenId) ?? null);
      else setCurrent(null);
    } catch {}
  }, [branchId, counterId, counters]);
  useEffect(() => { loadQueue(); }, [loadQueue]);

  useEffect(() => {
    if (!branchId) return;
    const es = new EventSource(streamUrl(branchId));
    es.onmessage = () => loadQueue();
    return () => es.close();
  }, [branchId, loadQueue]);

  const act = async (action: 'call-next' | 'complete' | 'no-show' | 'recall') => {
    if (!counterId) return;
    if (action === 'no-show' && !confirm(t('confirmNoShow'))) return;
    setBusy(true); setError('');
    try {
      await api(`/counters/${counterId}/${action}`, { method: 'POST', auth: true });
      await loadQueue();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  const setStatus = async (status: 'open' | 'break' | 'closed') => {
    if (!counterId) return;
    try {
      await api(`/counters/${counterId}/status`, { method: 'PATCH', auth: true, body: { status } });
      setCounters(await api<Counter[]>(`/counters?branchId=${branchId}`, { auth: true }));
    } catch (err) { setError((err as Error).message); }
  };

  const counter = counters.find((c) => c.id === counterId);
  return (
    <main className="wrap-wide">
      <h1>{t('title')}</h1>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <div className="grid grid-2">
          <div>
            <label>{t('branch')}</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label>{t('pickCounter')}</label>
            <select value={counterId} onChange={(e) => setCounterId(e.target.value)}>
              <option value="">—</option>
              {counters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
            </select>
          </div>
        </div>
      </div>

      {counter && (
        <>
          <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
            <p className="muted" style={{ margin: 0 }}>{t('current')}</p>
            <div className={`token-no ${current ? 'amber' : ''}`}>{current?.number ?? '—'}</div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
              <button className="btn amber big" onClick={() => act('call-next')} disabled={busy || !!current}>{t('callNext')}</button>
              <button className="btn big" onClick={() => act('complete')} disabled={busy || !current}>{t('complete')}</button>
              <button className="btn danger big" onClick={() => act('no-show')} disabled={busy || !current}>{t('noShow')}</button>
              <button className="btn secondary big" onClick={() => act('recall')} disabled={busy || !current}>{t('recall')}</button>
            </div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="btn small secondary" onClick={() => setStatus('open')}>{t('open')}</button>
              <button className="btn small secondary" onClick={() => setStatus('break')}>{t('break')}</button>
              <button className="btn small secondary" onClick={() => setStatus('closed')}>{t('close')}</button>
            </div>
          </div>

          <h2>{t('queue')} ({queue.filter((q) => q.status === 'waiting').length})</h2>
          <div className="card">
            <table>
              <thead><tr><th>Token</th><th>Service</th><th>Status</th><th>Position</th></tr></thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.id}>
                    <td className="mono"><strong>{q.number}</strong></td>
                    <td>{q.serviceName}</td>
                    <td><span className="badge">{q.status}</span></td>
                    <td>{q.status === 'waiting' && q.position ? q.position.position : '—'}</td>
                  </tr>
                ))}
                {queue.length === 0 && <tr><td colSpan={4} className="muted">{t('none')}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

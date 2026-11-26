'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, streamUrl, type Branch, type TokenView } from '@/lib/api';

type NowServing = { counterId: string; counterName: string; status: string; services: string[]; nowServing: string | null };

export default function DisplayPage({ params }: { params: Promise<{ locale: string; branch: string }> }) {
  const t = useTranslations('display');
  const [branchId, setBranchId] = useState('');
  const [branch, setBranch] = useState<Branch | null>(null);
  const [serving, setServing] = useState<NowServing[]>([]);
  const [queue, setQueue] = useState<TokenView[]>([]);
  const [sound, setSound] = useState(false);
  const [lastCalled, setLastCalled] = useState<string[]>([]);
  const lastCalledRef = useRef<string>('');

  useEffect(() => { params.then((p) => setBranchId(p.branch)); }, [params]);

  const load = async (id: string) => {
    try {
      const [b, s, q] = await Promise.all([
        api<Branch>(`/public/branches/${id}`),
        api<NowServing[]>(`/public/branches/${id}/now-serving`),
        api<{ id: string; number: string; serviceName: string }[]>(`/public/branches/${id}/queue`),
      ]);
      setBranch(b);
      setServing(s);
      setQueue(q.map((x) => ({ ...x, status: 'waiting' }) as TokenView));
    } catch { /* branch may not exist yet */ }
  };

  useEffect(() => {
    if (!branchId) return;
    load(branchId);
    const es = new EventSource(streamUrl(branchId));
    es.onmessage = (ev) => {
      load(branchId);
      try {
        const d = JSON.parse(ev.data);
        if (d.type === 'token_called' && d.token) {
          setLastCalled((prev) => [d.token as string, ...prev.filter((x) => x !== d.token)].slice(0, 5));
          if (sound && d.token !== lastCalledRef.current) {
            lastCalledRef.current = d.token;
            // Chime + spoken announcement (bn/en), best effort.
            try {
              const ctx = new AudioContext();
              const o = ctx.createOscillator(); o.frequency.value = 880;
              o.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.4);
            } catch {}
            try {
              const u = new SpeechSynthesisUtterance(`Token ${d.token}, ${d.counter || ''}`);
              speechSynthesis.speak(u);
            } catch {}
          }
        }
      } catch {}
    };
    return () => es.close();
  }, [branchId, sound]);

  const upNext = queue.filter((q) => q.status === 'waiting').slice(0, 3);
  return (
    <div className="tv">
      <main className="wrap-wide">
        <div className="space-between">
          <h1>{branch ? `${branch.name}${branch.nameBn ? ` — ${branch.nameBn}` : ''}` : '…'}</h1>
          {!sound && <button className="btn amber" onClick={() => setSound(true)}>{t('soundOn')}</button>}
        </div>
        <p className="label">{t('nowServing')}</p>
        {serving.length === 0 ? (
          <p>{t('noService')}</p>
        ) : (
          <div className="grid grid-2">
            {serving.map((c) => (
              <div key={c.counterId} className="card">
                <div className="counter-name">{c.counterName}</div>
                <div className="label small">{c.services.join(' · ')}</div>
                <div className="big-no">{c.nowServing ?? '—'}</div>
              </div>
            ))}
          </div>
        )}
        {upNext.length > 0 && (
          <>
            <h2 style={{ color: '#F7F5F0' }}>{t('upNext')}</h2>
            <div className="grid grid-3">
              {upNext.map((q) => (
                <div key={q.id} className="card"><div className="up-next-no">{q.number}</div><div className="label small">{q.serviceName}</div></div>
              ))}
            </div>
          </>
        )}
        {lastCalled.length > 0 && (
          <p className="small" style={{ marginTop: 24, color: '#A8A49C' }}>Last called: {lastCalled.join(' · ')}</p>
        )}
      </main>
    </div>
  );
}

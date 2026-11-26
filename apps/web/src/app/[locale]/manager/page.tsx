'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, apiUrl, getToken, getUser, streamUrl, type ManagerStats, type TokenView } from '@/lib/api';
import BranchPicker, { useBranches } from '@/components/BranchPicker';

export default function ManagerOverview() {
  const t = useTranslations('manager');
  const router = useRouter();
  const { branches, branchId, pick } = useBranches();
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [queue, setQueue] = useState<TokenView[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const u = getUser();
    if (!u) router.push('/bn/login');
  }, [router]);

  const load = async (id: string) => {
    if (!id) return;
    try {
      const [s, q] = await Promise.all([
        api<ManagerStats>(`/manager/stats?branchId=${id}`, { auth: true }),
        api<TokenView[]>(`/queue?branchId=${id}`, { auth: true }),
      ]);
      setStats(s); setQueue(q);
    } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { load(branchId); }, [branchId]);
  useEffect(() => {
    if (!branchId) return;
    const es = new EventSource(streamUrl(branchId));
    es.onmessage = () => load(branchId);
    return () => es.close();
  }, [branchId]);

  const exportCsv = async () => {
    // The export needs the JWT, so fetch it with auth and download as a blob.
    const res = await fetch(apiUrl(`/manager/export.csv?branchId=${branchId}`), { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) { setError(`Export failed (${res.status})`); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `queuepass-${branchId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sweep = async () => {
    if (!confirm(t('sweepConfirm'))) return;
    try {
      const r = await api<{ expired: number }>(`/branches/${branchId}/sweep`, { method: 'POST', auth: true });
      setMsg(t('swept', { n: r.expired }));
      load(branchId);
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <div className="space-between">
        <BranchPicker branchId={branchId} branches={branches} onPick={pick} />
        <div className="row">
          <button className="btn secondary small" onClick={exportCsv}>{t('exportCsv')}</button>
          <button className="btn danger small" onClick={sweep}>{t('sweep')}</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}
      {stats && (
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          <div className="card stat"><div className="label">{t('waiting')}</div><div className="value mono">{stats.waiting}</div></div>
          <div className="card stat"><div className="label">{t('served')}</div><div className="value mono">{stats.served}</div></div>
          <div className="card stat"><div className="label">{t('issued')}</div><div className="value mono">{stats.issued}</div></div>
          <div className="card stat"><div className="label">{t('noShow')}</div><div className="value mono">{stats.noShow} ({stats.noShowRate}%)</div></div>
          <div className="card stat"><div className="label">{t('avgWait')}</div><div className="value">{stats.avgWaitMin} min</div></div>
          <div className="card stat"><div className="label">{t('avgService')}</div><div className="value">{stats.avgServiceMin} min</div></div>
          <div className="card stat"><div className="label">{t('manager.counters')}</div><div className="value">{stats.countersOpen}/{stats.countersTotal}</div></div>
        </div>
      )}
      <h2>{t('waiting')} ({queue.filter((q) => q.status === 'waiting').length})</h2>
      <div className="card">
        <table>
          <thead><tr><th>Token</th><th>Service</th><th>Counter</th><th>Status</th><th>Position</th></tr></thead>
          <tbody>
            {queue.map((q) => (
              <tr key={q.id}>
                <td className="mono"><strong>{q.number}</strong></td>
                <td>{q.serviceName}</td>
                <td>{q.counterName ?? '—'}</td>
                <td><span className="badge">{q.status}</span></td>
                <td>{q.status === 'waiting' && q.position ? q.position.position : '—'}</td>
              </tr>
            ))}
            {queue.length === 0 && <tr><td colSpan={5} className="muted">—</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

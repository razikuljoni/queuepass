'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import BranchPicker, { useBranches } from '@/components/BranchPicker';

type Peak = { hour: number; visits: number };
type ByService = { id: string; name: string; nameBn?: string | null; codePrefix: string; avgServiceMin: number; waiting: number; served: number; noShow: number };

export default function AnalyticsPage() {
  const t = useTranslations('manager');
  const { branches, branchId, pick } = useBranches();
  const [peak, setPeak] = useState<Peak[]>([]);
  const [byService, setByService] = useState<ByService[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!branchId) return;
    Promise.all([
      api<Peak[]>(`/manager/peak-hours?branchId=${branchId}`, { auth: true }),
      api<ByService[]>(`/manager/by-service?branchId=${branchId}`, { auth: true }),
    ]).then(([p, b]) => { setPeak(p); setByService(b); }).catch((e) => setError((e as Error).message));
  }, [branchId]);

  const max = Math.max(1, ...peak.map((p) => p.visits));
  return (
    <>
      <BranchPicker branchId={branchId} branches={branches} onPick={pick} />
      {error && <div className="error">{error}</div>}
      <h2>{t('peakHours')} (7 days)</h2>
      <div className="card">
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120 }}>
          {peak.map((p) => (
            <div key={p.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span className="small muted">{p.visits || ''}</span>
              <div style={{ width: '100%', height: `${Math.max(2, (p.visits / max) * 80)}px`, background: 'var(--amber)', borderRadius: 2 }} />
              <span className="small muted">{p.hour}</span>
            </div>
          ))}
        </div>
      </div>
      <h2>{t('byService')}</h2>
      <div className="card">
        <table>
          <thead><tr><th>Service</th><th>Avg service</th><th>Waiting</th><th>Served</th><th>No-show</th></tr></thead>
          <tbody>
            {byService.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.codePrefix} — {s.name}</strong></td>
                <td>{s.avgServiceMin} min</td>
                <td>{s.waiting}</td>
                <td>{s.served}</td>
                <td>{s.noShow}</td>
              </tr>
            ))}
            {byService.length === 0 && <tr><td colSpan={5} className="muted">—</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

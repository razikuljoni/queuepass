'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Counter, type Service } from '@/lib/api';
import BranchPicker, { useBranches } from '@/components/BranchPicker';

export default function CountersPage() {
  const t = useTranslations('manager');
  const tc = useTranslations('common');
  const { branches, branchId, pick } = useBranches();
  const [counters, setCounters] = useState<Counter[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');

  const load = async (id: string) => {
    if (!id) return;
    try {
      const [c, s] = await Promise.all([
        api<Counter[]>(`/counters?branchId=${id}`, { auth: true }),
        api<Service[]>(`/services?branchId=${id}`, { auth: true }),
      ]);
      setCounters(c); setServices(s);
    } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { load(branchId); }, [branchId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await api('/counters', { method: 'POST', auth: true, body: { branchId, name, serviceIds: picked } });
      setName(''); setPicked([]);
      load(branchId);
    } catch (err) { setError((err as Error).message); }
  };

  const setStatus = async (c: Counter, status: 'open' | 'break' | 'closed') => {
    try {
      await api(`/counters/${c.id}/status`, { method: 'PATCH', auth: true, body: { status } });
      load(branchId);
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <>
      <BranchPicker branchId={branchId} branches={branches} onPick={pick} />
      {error && <div className="error">{error}</div>}
      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>{tc('name')}</th><th>{t('services')}</th><th>{tc('status')}</th><th>{tc('actions')}</th></tr></thead>
          <tbody>
            {counters.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.services?.map((s) => s.name).join(', ') || '—'}</td>
                <td><span className={`badge ${c.status === 'open' ? 'green' : c.status === 'break' ? 'amber' : 'red'}`}>{c.status}</span></td>
                <td>
                  <div className="row">
                    <button className="btn small secondary" onClick={() => setStatus(c, 'open')}>Open</button>
                    <button className="btn small secondary" onClick={() => setStatus(c, 'break')}>Break</button>
                    <button className="btn small secondary" onClick={() => setStatus(c, 'closed')}>Close</button>
                  </div>
                </td>
              </tr>
            ))}
            {counters.length === 0 && <tr><td colSpan={4} className="muted">—</td></tr>}
          </tbody>
        </table>
      </div>
      <h2>{tc('add')} — {t('counters')}</h2>
      <form onSubmit={add} className="card">
        <label>{tc('name')}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Counter 1" />
        <label>{t('services')}</label>
        <div className="row">
          {services.map((s) => (
            <label key={s.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={picked.includes(s.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} />
              {s.codePrefix} — {s.name}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 16 }}><button className="btn" type="submit">{tc('add')}</button></div>
      </form>
    </>
  );
}

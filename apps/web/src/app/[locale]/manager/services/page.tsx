'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Service } from '@/lib/api';
import BranchPicker, { useBranches } from '@/components/BranchPicker';

export default function ServicesPage() {
  const t = useTranslations('manager');
  const tc = useTranslations('common');
  const { branches, branchId, pick } = useBranches();
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [prefix, setPrefix] = useState('A');
  const [avgMin, setAvgMin] = useState('5');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async (id: string) => {
    if (!id) return;
    try { setServices(await api<Service[]>(`/services?branchId=${id}`, { auth: true })); } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { load(branchId); }, [branchId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMsg('');
    try {
      await api('/services', { method: 'POST', auth: true, body: { branchId, name, nameBn: nameBn || undefined, codePrefix: prefix.toUpperCase(), configuredServiceMin: Number(avgMin), avgServiceMin: Number(avgMin) } });
      setName(''); setNameBn(''); setMsg('✓');
      load(branchId);
    } catch (err) { setError((err as Error).message); }
  };

  const toggle = async (s: Service) => {
    try {
      await api(`/services/${s.id}/open`, { method: 'PATCH', auth: true, body: { isOpen: !s.isOpen } });
      load(branchId);
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <>
      <BranchPicker branchId={branchId} branches={branches} onPick={pick} />
      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}
      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>{tc('name')}</th><th>{tc('nameBn')}</th><th>Prefix</th><th>Avg</th><th>{tc('status')}</th><th>{tc('actions')}</th></tr></thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td><td>{s.nameBn ?? '—'}</td><td className="mono">{s.codePrefix}</td>
                <td>{s.avgServiceMin} {tc('min')}</td>
                <td><span className={`badge ${s.isOpen ? 'green' : ''}`}>{s.isOpen ? 'open' : 'closed'}</span></td>
                <td><button className="btn small secondary" onClick={() => toggle(s)}>{s.isOpen ? 'Pause' : 'Open'}</button></td>
              </tr>
            ))}
            {services.length === 0 && <tr><td colSpan={6} className="muted">—</td></tr>}
          </tbody>
        </table>
      </div>
      <h2>{tc('add')} — {t('services')}</h2>
      <form onSubmit={add} className="card">
        <div className="grid grid-2">
          <div><label>{tc('name')}</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label>{tc('nameBn')}</label><input value={nameBn} onChange={(e) => setNameBn(e.target.value)} /></div>
          <div><label>Prefix (A/B/C…)</label><input value={prefix} onChange={(e) => setPrefix(e.target.value.slice(0, 2))} required /></div>
          <div><label>Avg service ({tc('min')})</label><input type="number" min={1} value={avgMin} onChange={(e) => setAvgMin(e.target.value)} required /></div>
        </div>
        <div style={{ marginTop: 16 }}><button className="btn" type="submit">{tc('add')}</button></div>
      </form>
    </>
  );
}

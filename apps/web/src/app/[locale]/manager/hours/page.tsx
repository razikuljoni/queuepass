'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Branch } from '@/lib/api';
import BranchPicker, { useBranches } from '@/components/BranchPicker';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
type Hours = Record<string, { open: string; close: string; closed: boolean }>;

const DEFAULTS: Hours = Object.fromEntries(DAYS.map((d) => [d, { open: '09:00', close: '17:00', closed: d === 'fri' }]));

export default function HoursPage() {
  const tc = useTranslations('common');
  const { branches, branchId, pick } = useBranches();
  const [hours, setHours] = useState<Hours>(DEFAULTS);
  const [isOpen, setIsOpen] = useState(true);
  const [holidays, setHolidays] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!branchId) return;
    api<Branch[]>(`/branches`, { auth: true }).then((bs) => {
      const b = bs.find((x) => x.id === branchId) as unknown as { workingHours?: Hours; holidays?: string[]; isOpen?: boolean } | undefined;
      if (b?.workingHours && Object.keys(b.workingHours).length) setHours({ ...DEFAULTS, ...b.workingHours });
      if (b?.isOpen !== undefined) setIsOpen(b.isOpen);
      if (b?.holidays) setHolidays(b.holidays.join(', '));
    }).catch(() => {});
  }, [branchId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMsg('');
    try {
      await api(`/branches/${branchId}`, {
        method: 'PATCH', auth: true,
        body: { workingHours: hours, holidays: holidays.split(',').map((s) => s.trim()).filter(Boolean), isOpen },
      });
      setMsg('✓');
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <>
      <BranchPicker branchId={branchId} branches={branches} onPick={pick} />
      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}
      <form onSubmit={save} className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
            Branch open
          </label>
        </div>
        <table>
          <thead><tr><th>Day</th><th>Open</th><th>Close</th><th>Closed</th></tr></thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d}>
                <td style={{ textTransform: 'capitalize' }}>{d}</td>
                <td><input type="time" value={hours[d].open} disabled={hours[d].closed} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], open: e.target.value } })} /></td>
                <td><input type="time" value={hours[d].close} disabled={hours[d].closed} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], close: e.target.value } })} /></td>
                <td><input type="checkbox" style={{ width: 'auto' }} checked={hours[d].closed} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], closed: e.target.checked } })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <label>Holidays (YYYY-MM-DD, comma separated)</label>
        <input value={holidays} onChange={(e) => setHolidays(e.target.value)} placeholder="2026-12-16, 2026-12-25" />
        <div style={{ marginTop: 16 }}><button className="btn" type="submit">{tc('save')}</button></div>
      </form>
    </>
  );
}

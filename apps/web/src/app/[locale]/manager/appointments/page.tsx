'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, type Service } from '@/lib/api';
import BranchPicker, { useBranches } from '@/components/BranchPicker';

type Appt = { id: string; phone: string; name?: string | null; slotAt: string; status: string; service: { name: string; codePrefix: string } };

export default function AppointmentsPage() {
  const t = useTranslations('manager');
  const tc = useTranslations('common');
  const { branches, branchId, pick } = useBranches();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [slot, setSlot] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');

  const load = useCallback(async (id: string, d: string) => {
    if (!id) return;
    try {
      const [a, s] = await Promise.all([
        api<Appt[]>(`/appointments?branchId=${id}&date=${d}`, { auth: true }),
        api<Service[]>(`/services?branchId=${id}`, { auth: true }),
      ]);
      setAppts(a); setServices(s);
      if (!serviceId && s[0]) setServiceId(s[0].id);
    } catch (e) { setError((e as Error).message); }
  }, [serviceId]);
  useEffect(() => { load(branchId, date); }, [branchId, date, load]);

  const book = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await api('/appointments', { method: 'POST', auth: true, body: { branchId, serviceId, phone, name: name || undefined, slotAt: new Date(slot).toISOString() } });
      setPhone(''); setName(''); setSlot('');
      load(branchId, date);
    } catch (err) { setError((err as Error).message); }
  };

  const act = async (id: string, action: 'check-in' | 'cancel') => {
    try {
      await api(`/appointments/${id}/${action}`, { method: 'POST', auth: true });
      load(branchId, date);
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <>
      <div className="row">
        <BranchPicker branchId={branchId} branches={branches} onPick={pick} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 180 }} />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>Slot</th><th>Service</th><th>Phone</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {appts.map((a) => (
              <tr key={a.id}>
                <td className="mono">{new Date(a.slotAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{a.service.codePrefix} — {a.service.name}</td>
                <td className="mono">{a.phone}</td>
                <td>{a.name ?? '—'}</td>
                <td><span className="badge">{a.status}</span></td>
                <td>
                  <div className="row">
                    {a.status === 'booked' && <button className="btn small" onClick={() => act(a.id, 'check-in')}>Check in</button>}
                    {a.status === 'booked' && <button className="btn small danger" onClick={() => act(a.id, 'cancel')}>Cancel</button>}
                  </div>
                </td>
              </tr>
            ))}
            {appts.length === 0 && <tr><td colSpan={6} className="muted">—</td></tr>}
          </tbody>
        </table>
      </div>
      <h2>Book appointment</h2>
      <form onSubmit={book} className="card">
        <div className="grid grid-2">
          <div>
            <label>{t('services')}</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
              {services.map((s) => <option key={s.id} value={s.id}>{s.codePrefix} — {s.name}</option>)}
            </select>
          </div>
          <div><label>Slot</label><input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} required /></div>
          <div><label>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} pattern="01[3-9][0-9]{8}" required /></div>
          <div><label>{tc('name')}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 16 }}><button className="btn" type="submit">Book</button></div>
      </form>
    </>
  );
}

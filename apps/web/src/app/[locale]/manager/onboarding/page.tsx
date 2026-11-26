'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

export default function OnboardingPage() {
  const tc = useTranslations('common');
  const [branchName, setBranchName] = useState('');
  const [branchNameBn, setBranchNameBn] = useState('');
  const [address, setAddress] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceNameBn, setServiceNameBn] = useState('');
  const [prefix, setPrefix] = useState('A');
  const [counterName, setCounterName] = useState('Counter 1');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMsg(''); setBusy(true);
    try {
      const branch = await api<{ id: string }>('/branches', { method: 'POST', auth: true, body: { name: branchName, nameBn: branchNameBn || undefined, address } });
      const service = await api<{ id: string }>('/services', { method: 'POST', auth: true, body: { branchId: branch.id, name: serviceName, nameBn: serviceNameBn || undefined, codePrefix: prefix.toUpperCase(), configuredServiceMin: 5, avgServiceMin: 5 } });
      await api('/counters', { method: 'POST', auth: true, body: { branchId: branch.id, name: counterName, serviceIds: [service.id] } });
      setMsg(`✓ ${branchName} is ready — branch, service ${prefix} and ${counterName} created.`);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}
      <p className="muted">Create a branch with its first service and counter in one go. You can add more services and counters afterwards.</p>
      <form onSubmit={submit} className="card">
        <h3 style={{ marginTop: 0 }}>1 — Branch</h3>
        <div className="grid grid-2">
          <div><label>{tc('name')}</label><input value={branchName} onChange={(e) => setBranchName(e.target.value)} required placeholder="CityCare Hospital — Mirpur 10" /></div>
          <div><label>{tc('nameBn')}</label><input value={branchNameBn} onChange={(e) => setBranchNameBn(e.target.value)} /></div>
          <div><label>Address</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Mirpur 10, Dhaka" /></div>
        </div>
        <h3>2 — First service</h3>
        <div className="grid grid-3">
          <div><label>{tc('name')}</label><input value={serviceName} onChange={(e) => setServiceName(e.target.value)} required placeholder="Doctor Consultation" /></div>
          <div><label>{tc('nameBn')}</label><input value={serviceNameBn} onChange={(e) => setServiceNameBn(e.target.value)} /></div>
          <div><label>Prefix</label><input value={prefix} onChange={(e) => setPrefix(e.target.value.slice(0, 2))} required /></div>
        </div>
        <h3>3 — First counter</h3>
        <label>{tc('name')}</label>
        <input value={counterName} onChange={(e) => setCounterName(e.target.value)} required />
        <div style={{ marginTop: 16 }}><button className="btn big" type="submit" disabled={busy}>{busy ? '…' : 'Create branch'}</button></div>
      </form>
    </>
  );
}

'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

export default function StaffPage() {
  const tc = useTranslations('common');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'counter' | 'branch_manager' | 'viewer'>('counter');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMsg('');
    try {
      await api('/auth/staff', {
        method: 'POST', auth: true,
        body: { name, email, role, password: password || undefined, pin: pin || undefined },
      });
      setMsg(`✓ ${email} (${role})`);
      setName(''); setEmail(''); setPassword(''); setPin('');
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <>
      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}
      <p className="muted">Counter staff sign in with email + 4-digit PIN for a shift. Managers use a password.</p>
      <form onSubmit={submit} className="card">
        <div className="grid grid-2">
          <div><label>{tc('name')}</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div>
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as never)}>
              <option value="counter">Counter</option>
              <option value="branch_manager">Branch manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div><label>Password {role === 'counter' ? '(optional)' : ''}</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div><label>PIN (4 digits, for counter staff)</label><input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} /></div>
        </div>
        <div style={{ marginTop: 16 }}><button className="btn" type="submit">{tc('add')}</button></div>
      </form>
    </>
  );
}

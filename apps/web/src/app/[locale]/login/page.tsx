'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, saveSession, type User } from '@/lib/api';

export default function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const t = useTranslations('login');
  const router = useRouter();
  const [locale, setLocale] = useState('bn');
  const [mode, setMode] = useState<'password' | 'pin'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useState(() => { params.then((p) => setLocale(p.locale)); });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const path = mode === 'pin' ? '/auth/pin-login' : '/auth/login';
      const body = mode === 'pin' ? { email, pin } : { email, password };
      const res = await api<{ token: string; user: User }>(path, { method: 'POST', body });
      saveSession(res.token, res.user);
      router.push(res.user.role === 'counter' ? `/${locale}/counter` : `/${locale}/manager`);
    } catch { setError(t('bad')); } finally { setBusy(false); }
  };

  return (
    <main className="wrap">
      <h1>{t('title')}</h1>
      {error && <div className="error">{error}</div>}
      <form onSubmit={submit} className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <button type="button" className={`btn small ${mode === 'password' ? '' : 'secondary'}`} onClick={() => setMode('password')}>{t('passwordLogin')}</button>
          <button type="button" className={`btn small ${mode === 'pin' ? '' : 'secondary'}`} onClick={() => setMode('pin')}>{t('pinLogin')}</button>
        </div>
        <label>{t('email')}</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        {mode === 'password' ? (
          <>
            <label>{t('password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </>
        ) : (
          <>
            <label>{t('pin')}</label>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} required inputMode="numeric" maxLength={4} />
          </>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="btn big" type="submit" disabled={busy}>{t('submit')}</button>
        </div>
      </form>
    </main>
  );
}

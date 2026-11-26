'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, type Branch, type Service } from '@/lib/api';

export default function JoinPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState('bn');
  useEffect(() => { params.then((p) => setLocale(p.locale)); }, [params]);
  const t = useTranslations('join');
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<'normal' | 'priority'>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api<Branch[]>('/public/branches').then(setBranches).catch(() => setError(t('noBranches'))); }, [t]);
  useEffect(() => {
    if (!branchId) { setServices([]); return; }
    api<Service[]>(`/public/branches/${branchId}/services`).then((s) => { setServices(s); setServiceId(s[0]?.id ?? ''); }).catch(() => setServices([]));
  }, [branchId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<{ publicCode: string }>('/public/join', {
        method: 'POST',
        body: { branchId, serviceId, phone: phone.trim(), name: name.trim() || undefined, priority, locale },
      });
      router.push(`/${locale}/t/${res.publicCode}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="wrap">
      <h1>{t('title')}</h1>
      <p className="sub">{t('subtitle')}</p>
      {error && <div className="error">{error}</div>}
      {branches.length === 0 ? (
        <p className="muted">{t('noBranches')}</p>
      ) : (
        <form onSubmit={submit} className="card">
          <label>{t('branch')}</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            <option value="">—</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.nameBn ? ` — ${b.nameBn}` : ''}{b.address ? ` (${b.address})` : ''}</option>
            ))}
          </select>
          <label>{t('service')}</label>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required disabled={!services.length}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.codePrefix} — {s.name}{s.nameBn ? ` (${s.nameBn})` : ''} · ~{s.avgServiceMin} min</option>
            ))}
          </select>
          <label>{t('phone')}</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phonePh')} pattern="01[3-9][0-9]{8}" required inputMode="tel" />
          <label>{t('name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePh')} />
          <label>{t('priority')}</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as 'normal' | 'priority')}>
            <option value="normal">{t('normal')}</option>
            <option value="priority">{t('priorityOpt')}</option>
          </select>
          <div style={{ marginTop: 16 }}>
            <button className="btn big" type="submit" disabled={busy || !branchId || !serviceId}>
              {busy ? t('taking') : t('submit')}
            </button>
          </div>
        </form>
      )}
      {branchId && (
        <p className="small muted" style={{ marginTop: 16 }}>
          <a href={`/${locale}/display/${branchId}`}>TV display</a> · <a href={`/${locale}/kiosk/${branchId}`}>Kiosk</a>
        </p>
      )}
    </main>
  );
}

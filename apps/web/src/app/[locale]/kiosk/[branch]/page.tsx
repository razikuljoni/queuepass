'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, type Branch, type Service } from '@/lib/api';

export default function KioskPage({ params }: { params: Promise<{ locale: string; branch: string }> }) {
  const t = useTranslations('join');
  const router = useRouter();
  const [locale, setLocale] = useState('bn');
  const [branchId, setBranchId] = useState('');
  const [branch, setBranch] = useState<Branch | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => { params.then((p) => { setLocale(p.locale); setBranchId(p.branch); }); }, [params]);
  useEffect(() => {
    if (!branchId) return;
    api<Branch>(`/public/branches/${branchId}`).then(setBranch).catch(() => {});
    api<Service[]>(`/public/branches/${branchId}/services`).then(setServices).catch(() => {});
  }, [branchId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = await api<{ publicCode: string; number: string }>('/public/join', {
        method: 'POST',
        body: { branchId, serviceId, phone: phone.trim(), locale },
      });
      setDone(res.number);
      setPhone('');
      setTimeout(() => router.push(`/${locale}/t/${res.publicCode}`), 4000);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <main className="wrap">
      <h1>{branch?.name ?? '…'}</h1>
      <p className="sub">{t('subtitle')}</p>
      {error && <div className="error">{error}</div>}
      {done && <div className="ok" style={{ fontSize: 20 }}>✓ {done}</div>}
      <form onSubmit={submit} className="card">
        <label>{t('service')}</label>
        <div className="grid grid-2">
          {services.map((s) => (
            <button key={s.id} type="button" className={`btn kiosk-btn ${serviceId === s.id ? '' : 'secondary'}`} onClick={() => setServiceId(s.id)}>
              {s.codePrefix} — {s.name}
            </button>
          ))}
        </div>
        <label>{t('phone')}</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phonePh')} pattern="01[3-9][0-9]{8}" required inputMode="tel" style={{ fontSize: 20, padding: 14 }} />
        <div style={{ marginTop: 16 }}>
          <button className="btn big" type="submit" disabled={busy || !serviceId}>{busy ? t('taking') : t('submit')}</button>
        </div>
      </form>
    </main>
  );
}

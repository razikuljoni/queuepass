'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const TABS = ['overview', 'services', 'counters', 'hours', 'appointments', 'analytics', 'sms', 'audit', 'billing', 'staff', 'onboarding'] as const;

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('manager');
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bn';
  const seg = pathname.split('/').pop() || '';
  const active = (tab: string) => {
    if (tab === 'overview') return pathname === `/${locale}/manager` || seg === 'manager';
    return seg === tab;
  };
  return (
    <main className="wrap-wide">
      <h1>{t('title')}</h1>
      <nav className="tabs">
        {TABS.map((tab) => (
          <Link key={tab} href={tab === 'overview' ? `/${locale}/manager` : `/${locale}/manager/${tab}`} className={active(tab) ? 'active' : ''}>
            {t(tab as never)}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}

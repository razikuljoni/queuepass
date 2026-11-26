'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { clearSession, getUser } from '@/lib/api';
import { useEffect, useState } from 'react';

export default function Header({ locale }: { locale: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  useEffect(() => { setUser(getUser()); }, [pathname]);
  const isActive = (p: string) => pathname === `/${locale}${p}` || pathname === p;
  const switchLocale = (next: string) => {
    const rest = pathname.replace(/^\/(bn|en)/, '') || '/';
    router.push(`/${next}${rest}`);
  };
  return (
    <header className="top">
      <div className="inner">
        <Link href={`/${locale}`} className="brand">Queue<span>Pass</span></Link>
        <nav className="main">
          <Link href={`/${locale}`} className={isActive('/') ? 'active' : ''}>{t('join')}</Link>
          <Link href={`/${locale}/counter`} className={isActive('/counter') ? 'active' : ''}>{t('counter')}</Link>
          <Link href={`/${locale}/manager`} className={isActive('/manager') ? 'active' : ''}>{t('manager')}</Link>
          {user ? (
            <button className="linklike" onClick={() => { clearSession(); setUser(null); router.push(`/${locale}`); }}>
              {t('logout')} ({user.name})
            </button>
          ) : (
            <Link href={`/${locale}/login`} className={isActive('/login') ? 'active' : ''}>{t('login')}</Link>
          )}
          <span className="lang">
            <button className={locale === 'bn' ? 'on' : ''} onClick={() => switchLocale('bn')}>বাংলা</button>
            <button className={locale === 'en' ? 'on' : ''} onClick={() => switchLocale('en')}>EN</button>
          </span>
        </nav>
      </div>
    </header>
  );
}

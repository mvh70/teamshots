'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onSelectChange(nextLocale: string) {
    startTransition(() => {
      // Don't switch if already on the same locale
      if (locale === nextLocale) return;
      
      // Use the router from next-intl/navigation which handles locale prefixes correctly
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Language selection">
      <button
        onClick={() => onSelectChange('en')}
        disabled={isPending}
        aria-pressed={locale === 'en'}
        className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${
          locale === 'en'
            ? 'bg-brand-primary-hover text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => onSelectChange('es')}
        disabled={isPending}
        aria-pressed={locale === 'es'}
        className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${
          locale === 'es'
            ? 'bg-brand-primary-hover text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        ES
      </button>
    </div>
  );
}


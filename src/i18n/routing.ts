import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'en';

export function isAppLocale(locale: string | null | undefined): locale is AppLocale {
  if (!locale) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: SUPPORTED_LOCALES,

  // Used when no locale matches
  defaultLocale: DEFAULT_LOCALE,

  // Locale detection strategy - 'as-needed' means default locale (en) won't show in URL
  localePrefix: 'as-needed'
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

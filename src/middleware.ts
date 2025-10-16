import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware({
  // A list of all locales that are supported
  locales: routing.locales,

  // Used when no locale matches
  defaultLocale: routing.defaultLocale,

  // Always show locale prefix
  localePrefix: routing.localePrefix
});

export const config = {
  // Match only internationalized pathnames
  // Exclude API routes, auth routes, and static files
  matcher: ['/', '/(es|en)/:path*', '/((?!api|auth|app-routes|_next|_vercel|.*\\..*).*)']
};

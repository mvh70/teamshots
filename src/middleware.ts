import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse, NextRequest } from 'next/server'
import { getRequestHeader } from '@/lib/server-headers'
import { auth } from '@/auth'

export const runtime = 'nodejs'

const PROTECTED_PATH_PREFIXES = ['/app']
const ADMIN_PATH_PREFIXES = ['/app/admin']

function removeLocalePrefix(pathname: string) {
  const segments = pathname.split('/')
  if (segments.length > 1 && ['en', 'es'].includes(segments[1])) {
    return '/' + segments.slice(2).join('/')
  }
  return pathname
}

function isProtectedPath(pathname: string) {
  const normalized = removeLocalePrefix(pathname)
  return PROTECTED_PATH_PREFIXES.some(prefix => normalized.startsWith(prefix))
}

function isAdminPath(pathname: string) {
  const normalized = removeLocalePrefix(pathname)
  return ADMIN_PATH_PREFIXES.some(prefix => normalized.startsWith(prefix))
}

function addSecurityHeaders(response: NextResponse) {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // HSTS
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=()'
  )
  
  // Content Security Policy - Using nonces for Next.js inline scripts
  // PostHog domains: supports both EU and US regions
  const posthogDomains = [
    'https://app.posthog.com',
    'https://eu.i.posthog.com',
    'https://us.i.posthog.com',
    'https://app-assets.i.posthog.com',
    'https://eu-assets.i.posthog.com',
    'https://us-assets.i.posthog.com'
  ].join(' ')
  
  // TEMPORARILY DISABLED: Strict CSP disabled while code is changing frequently
  // TODO: Re-enable strict CSP when codebase stabilizes
  // For now, allow unsafe-inline in both dev and production to avoid hash management
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // Allow unsafe-inline and unsafe-eval for now (both dev and production)
  // This allows all inline scripts without needing to manage hashes
  // When ready to re-enable strict CSP:
  // 1. Remove 'unsafe-inline' from production
  // 2. Add production hashes when you see CSP violations
  const unsafeInlineDirective = "'unsafe-inline'" // Temporarily enabled for both environments
  const unsafeEvalDirective = isDevelopment ? "'unsafe-eval'" : '' // Only in dev for webpack HMR
  
  const scriptSrc = [
    "'self'",
    unsafeInlineDirective, // Allows all inline scripts (temporary)
    unsafeEvalDirective, // Only in development for webpack HMR
    'https://static.cloudflareinsights.com',
    'https://pineapple.teamshotspro.com',
    posthogDomains
  ].filter(Boolean).join(' ')
  
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // Keep unsafe-inline for styles as Next.js requires it for CSS-in-JS
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://api.resend.com https://cloudflareinsights.com https://pineapple.teamshotspro.com ${posthogDomains} ws: wss:`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:"
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)
  
  // Add missing security headers
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('X-Download-Options', 'noopen')
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  
  return response
}

// Wrap the intl middleware
const intlMiddleware = createMiddleware({
  locales: routing.locales,
  defaultLocale: routing.defaultLocale,
  localePrefix: routing.localePrefix
})

export default async function middleware(request: NextRequest) {
  try {
    // Allow E2E tests to bypass locale detection/redirects
    if (await getRequestHeader('x-playwright-e2e') === '1') {
      const res = NextResponse.next()
      // Preserve existing E2E headers if they exist, otherwise add defaults
      if (!res.headers.get('x-e2e-user-id')) {
        res.headers.set('x-e2e-user-id', 'test-user-id')
      }
      if (!res.headers.get('x-e2e-user-email')) {
        res.headers.set('x-e2e-user-email', 'test@example.com')
      }
      if (!res.headers.get('x-e2e-user-role')) {
        res.headers.set('x-e2e-user-role', 'user')
      }
      if (!res.headers.get('x-e2e-user-locale')) {
        res.headers.set('x-e2e-user-locale', 'en')
      }
      return addSecurityHeaders(res)
    }
    
    // Safari-specific fix: Handle protocol-less URLs
    const url = request.nextUrl
    if (url.protocol === 'about:' || !url.protocol) {
      // Redirect to proper protocol
      const newUrl = new URL(request.url)
      newUrl.protocol = (await getRequestHeader('x-forwarded-proto')) || 'http'
      return addSecurityHeaders(NextResponse.redirect(newUrl, 301))
    }
    
    if (isProtectedPath(request.nextUrl.pathname)) {
      const session = await auth()
      if (!session?.user) {
        const loginUrl = new URL('/auth/signin', request.url)
        loginUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`)
        return addSecurityHeaders(NextResponse.redirect(loginUrl))
      }
      
      // Admin route protection - redirect non-admins to dashboard
      if (isAdminPath(request.nextUrl.pathname) && !session?.user?.isAdmin) {
        return addSecurityHeaders(NextResponse.redirect(new URL('/app/dashboard', request.url)))
      }
    }

    const response = intlMiddleware(request)
    
    return addSecurityHeaders(response)
  } catch (error) {
    // If middleware fails, log error but don't block the request
    console.error('Middleware error:', error)
    // Return a basic response without security headers to allow debugging
    const response = intlMiddleware(request)
    return response
  }
}

export const config = {
  matcher: ['/', '/(es|en)/:path*', '/((?!api|auth|invite|_next|_vercel|.*\\..*).*)']
};

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getRequestHeader } from '@/lib/server-headers'

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
  
  // Content Security Policy - Safari-compatible version
  // PostHog domains: supports both EU and US regions
  const posthogDomains = [
    'https://app.posthog.com',
    'https://eu.i.posthog.com',
    'https://us.i.posthog.com',
    'https://app-assets.i.posthog.com',
    'https://eu-assets.i.posthog.com',
    'https://us-assets.i.posthog.com'
  ].join(' ')
  
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://static.cloudflareinsights.com ${posthogDomains}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://api.resend.com https://cloudflareinsights.com ${posthogDomains} ws: wss:`,
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
    return NextResponse.redirect(newUrl, 301)
  }
  
  const response = intlMiddleware(request)
  
  return addSecurityHeaders(response)
}

export const config = {
  matcher: ['/', '/(es|en)/:path*', '/((?!api|auth|invite|_next|_vercel|.*\\..*).*)']
};

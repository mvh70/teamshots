import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse, NextRequest } from 'next/server'
import { getRequestHeader } from '@/lib/server-headers'
import { auth } from '@/auth'
import { ALLOWED_DOMAINS } from '@/lib/url'
import { getRequestDomain } from '@/lib/domain'

const PROTECTED_PATH_PREFIXES = ['/app']
const ADMIN_PATH_PREFIXES = ['/app/admin']

/**
 * Strip default ports from URLs to fix reverse proxy :80 issue.
 * Cloudflare/Hetzner can forward x-forwarded-port: 80 even for HTTPS traffic,
 * causing request.url to contain https://domain.com:80 which breaks redirects.
 */
function stripDefaultPort(url: URL): URL {
  // Strip :80 from https (the bug), and standard defaults
  if (url.protocol === 'https:' && url.port === '80') {
    url.port = ''
  } else if (url.protocol === 'https:' && url.port === '443') {
    url.port = ''
  } else if (url.protocol === 'http:' && url.port === '80') {
    url.port = ''
  }
  return url
}

/**
 * Create a clean redirect URL by stripping default ports.
 */
function createCleanRedirectUrl(path: string, baseUrl: string | URL): URL {
  const url = new URL(path, baseUrl)
  return stripDefaultPort(url)
}

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

  // SECURITY NOTE: CSP currently uses 'unsafe-inline' which creates XSS risk
  // TODO: Migrate to nonce-based CSP for production (Phase 2)
  // For now:
  // - unsafe-eval REMOVED from production (Phase 1 complete)
  // - unsafe-inline still present but monitored via report-only CSP
  const unsafeInlineDirective = "'unsafe-inline'" // Temporary - needed for Next.js CSS-in-JS
  const unsafeEvalDirective = isDevelopment ? "'unsafe-eval'" : '' // Only in dev for webpack HMR

  const scriptSrc = [
    "'self'",
    unsafeInlineDirective, // Allows inline scripts (monitored)
    unsafeEvalDirective, // PRODUCTION: REMOVED (Phase 1 security fix)
    'https://static.cloudflareinsights.com',
    'https://pineapple.teamshotspro.com',
    'https://www.googletagmanager.com', // Google Tag Manager & Analytics
    'https://assets.apollo.io', // Apollo.io
    posthogDomains
  ].filter(Boolean).join(' ')
  
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.googletagmanager.com", // Allow GTM & Google Fonts styles
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com", // Allow Google Fonts
    `connect-src 'self' https://api.resend.com https://cloudflareinsights.com https://pineapple.teamshotspro.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://www.googletagmanager.com https://storage.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://tfhub.dev https://www.kaggle.com https://*.apollo.io ${posthogDomains} ws: wss:`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:"
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)

  // Report-only CSP temporarily disabled to reduce console noise during GTM setup
  // TODO: Re-enable after analytics stabilizes for better security monitoring
  // if (isProduction) {
  //   const strictScriptSrc = [
  //     "'self'",
  //     'https://static.cloudflareinsights.com',
  //     'https://pineapple.teamshotspro.com',
  //     'https://www.googletagmanager.com',
  //     posthogDomains
  //   ].filter(Boolean).join(' ')

  //   const reportOnlyCSP = [
  //     "default-src 'self'",
  //     `script-src ${strictScriptSrc}`,
  //     "style-src 'self'",
  //     "img-src 'self' data: https: blob:",
  //     "font-src 'self' data:",
  //     `connect-src 'self' https://api.resend.com https://cloudflareinsights.com https://pineapple.teamshotspro.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com ${posthogDomains} ws: wss:`,
  //     "frame-ancestors 'none'",
  //     "base-uri 'self'",
  //     "form-action 'self'",
  //     "object-src 'none'",
  //     "report-uri /api/csp-report"
  //   ].join('; ')

  //   response.headers.set('Content-Security-Policy-Report-Only', reportOnlyCSP)
  // }

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

export default async function proxy(request: NextRequest) {
  try {
    // Redirect www to non-www for SEO canonicalization
    // This prevents duplicate content issues in Google Search Console
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || ''
    if (host.startsWith('www.')) {
      const newUrl = new URL(request.url)
      newUrl.host = host.replace(/^www\./, '')
      stripDefaultPort(newUrl)
      return NextResponse.redirect(newUrl, 301)
    }

    // Allow E2E tests to bypass locale detection/redirects
    if ((await getRequestHeader('x-playwright-e2e')) === '1') {
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
      stripDefaultPort(newUrl)
      return addSecurityHeaders(NextResponse.redirect(newUrl, 301))
    }
    
    if (isProtectedPath(request.nextUrl.pathname)) {
      const session = await auth()
      if (!session?.user) {
        const loginUrl = createCleanRedirectUrl('/auth/signin', request.url)
        loginUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`)
        return addSecurityHeaders(NextResponse.redirect(loginUrl))
      }
      
      // Admin route protection - redirect non-admins to dashboard
      if (isAdminPath(request.nextUrl.pathname) && !session?.user?.isAdmin) {
        return addSecurityHeaders(NextResponse.redirect(createCleanRedirectUrl('/app/dashboard', request.url)))
      }
      
      // Cross-domain redirect: Ensure users stay on their signup domain
      // This maintains brand consistency - users who signed up on photoshotspro.com
      // should be redirected there if they try to access via teamshotspro.com
      const signupDomain = session.user.signupDomain
      if (signupDomain) {
        const currentDomain = getRequestDomain(request)
        const normalizedSignupDomain = signupDomain.replace(/^www\./, '').toLowerCase()
        
        // Skip redirect for localhost signupDomain (legacy development users)
        // These users can access from any domain
        if (normalizedSignupDomain === 'localhost') {
          // No redirect - allow access from any domain
          // This handles legacy users who signed up during development
        } else {
          // Only redirect if domains differ and signup domain is valid
          // Skip redirect in development unless explicitly testing cross-domain
          const shouldRedirect = currentDomain && 
            currentDomain !== normalizedSignupDomain && 
            (ALLOWED_DOMAINS as readonly string[]).includes(normalizedSignupDomain) &&
            (process.env.NODE_ENV === 'production' || process.env.ENABLE_CROSS_DOMAIN_REDIRECT === 'true')
          
          if (shouldRedirect) {
            const redirectUrl = new URL(request.url)
            redirectUrl.hostname = normalizedSignupDomain
            // Ensure we use https in production, http in development
            redirectUrl.protocol = process.env.NODE_ENV === 'production' ? 'https:' : 'http:'
            // Remove port for clean URL
            redirectUrl.port = ''
            return addSecurityHeaders(NextResponse.redirect(redirectUrl, 302))
          }
        }
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

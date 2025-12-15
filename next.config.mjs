import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['next-intl'],
  output: 'standalone', // Enable for Docker deployment
  // Performance optimizations
  swcMinify: true,
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },
  images: {
    // Enable Next.js image optimization
    remotePatterns: [
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }
    ],
    localPatterns: [
      {
        pathname: '/branding/**',
      },
      {
        pathname: '/samples/**',
      },
      {
        pathname: '/api/**',
      },
      {
        pathname: '/images/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self)'
          },
          // Safari-specific headers to handle protocol issues
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Add Cross-Origin-Opener-Policy for security (fixes PageSpeed warning)
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          // Preconnect to PostHog analytics domain for better performance
          {
            key: 'Link',
            value: '<https://pineapple.teamshotspro.com>; rel=preconnect; crossorigin'
          }
        ]
      },
      // Long cache headers for static assets (Cloudflare will respect these)
      {
        source: '/samples/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/branding/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      // Cache other static assets aggressively
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/public/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  },
};

export default withNextIntl(nextConfig);
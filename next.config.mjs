import { withSentryConfig } from '@sentry/nextjs';
import path from 'node:path';

const requestConfigPath = './src/i18n/request.ts';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow E2E tests to run a separate dev server without conflicting with the main one
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Dev-only host allowlist for local brand aliases (e.g. https://teamshotspro:3000).
  // This does not affect production.
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    'teamshotspro',
    '*.teamshotspro',
    'teamshotspro.com',
    '*.teamshotspro.com',
    'portreya',
    '*.portreya',
    'portreya.com',
    '*.portreya.com',
    'individualshots',
    '*.individualshots',
    'individualshots.com',
    '*.individualshots.com',
    'coupleshots',
    '*.coupleshots',
    'coupleshots.com',
    '*.coupleshots.com',
    'familyshots',
    '*.familyshots',
    'familyshots.com',
    '*.familyshots.com',
    'rightclickfit',
    '*.rightclickfit',
    'rightclickfit.com',
    '*.rightclickfit.com',
  ],
  transpilePackages: ['next-intl'],
  output: 'standalone', // Enable for Docker deployment
  turbopack: {
    resolveAlias: {
      'next-intl/config': requestConfigPath,
    },
  },
  experimental: {
    // optimizeCss disabled - requires @parcel/watcher native bindings that fail in Nixpacks builds
    // optimizeCss: true,
    scrollRestoration: true,
    optimizePackageImports: [
      '@heroicons/react',
      'lucide-react',
      '@/components/ui',
      // NOTE: Do NOT add '@/domain/style/elements' here - it has side-effect imports
      // for registering element metadata that get skipped when this optimization is applied
    ],
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias['next-intl/config'] = path.resolve(process.cwd(), requestConfigPath);
    return config;
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
      {
        pathname: '/blog/**',
      },
    ],
  },
  async redirects() {
    return [
      // 301 redirect /en/* to /* — English is the default locale and should not have a prefix.
      // Google Search Console was crawling old /en/ URLs (e.g. /en/blog/best-ai-headshot-generators)
      // that need permanent redirects to their canonical versions without the prefix.
      {
        source: '/en',
        destination: '/',
        permanent: true,
      },
      {
        source: '/en/:path*',
        destination: '/:path*',
        permanent: true,
      },
    ]
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
        source: '/blog/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400'
          }
        ]
      },
      {
        source: '/es/blog/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400'
          }
        ]
      },
      {
        source: '/solutions/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400'
          }
        ]
      },
      {
        source: '/es/soluciones/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400'
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

const sentryConfig = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "carpe-diem-ventures",

  project: "teamshotspro",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});

// Sentry adds `ioredis` to serverExternalPackages by default, but BullMQ imports
// `ioredis/built/utils`, which cannot be externalized reliably by Node resolution.
// Keep other Sentry externals intact while forcing ioredis to be bundled.
sentryConfig.serverExternalPackages = (sentryConfig.serverExternalPackages || [])
  .filter((pkg) => pkg !== 'ioredis');

export default sentryConfig;

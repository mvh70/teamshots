import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['next-intl'],
  output: 'standalone', // Enable for Docker deployment
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }
    ]
  },
  async rewrites() {
    return [
      { source: '/dashboard', destination: '/app-routes/dashboard' },
      { source: '/team', destination: '/app-routes/team' },
      { source: '/generations', destination: '/app-routes/generations' },
      { source: '/templates', destination: '/app-routes/templates' },
      { source: '/analytics', destination: '/app-routes/analytics' },
      { source: '/generate', destination: '/app-routes/generate' },
      { source: '/settings', destination: '/app-routes/settings' }
    ]
  }
};

export default withNextIntl(nextConfig);


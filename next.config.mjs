import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['next-intl'],
  output: 'standalone', // Enable for Docker deployment
  /* config options here */
};

export default withNextIntl(nextConfig);


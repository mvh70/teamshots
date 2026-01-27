import SessionProvider from '@/components/SessionProvider'
import { PostHogProvider } from '@/components/PostHogProvider'
import { GoogleTagManager } from '@next/third-parties/google'
import { auth } from '@/auth'
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { getBrand } from '@/config/brand'
import { getBaseUrl } from '@/lib/url'
import { headers } from 'next/headers'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const brandConfig = getBrand(headersList)
  const baseUrl = getBaseUrl(headersList)

  return {
    metadataBase: new URL(baseUrl),
    title: {
      template: `%s | ${brandConfig.name}`,
      default: brandConfig.name,
    },
    description: `Professional AI headshots with ${brandConfig.name}`,
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: brandConfig.logo.icon, type: 'image/png' },
      ],
      apple: '/apple-icon.png',
      shortcut: '/favicon.ico',
    },
    referrer: 'strict-origin-when-cross-origin',
    openGraph: {
      type: 'website',
      siteName: brandConfig.name,
      locale: 'en_US',
      alternateLocale: ['es_ES'],
      url: baseUrl,
    },
    twitter: {
      card: 'summary_large_image',
    },
    other: {
      'format-detection': 'telephone=no',
      'apple-mobile-web-app-capable': 'yes',
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'default',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Note: Next.js App Router allows async RootLayout
  // but TypeScript may not infer it automatically; keep function sync and
  // use a top-level async IIFE to fetch the session.
  // We'll render a wrapper that awaits the session server-side.
  return (
    <html lang="en">
      {process.env.NEXT_PUBLIC_GTM_ID && (
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
      )}
      <head>
        <meta httpEquiv="Permissions-Policy" content="camera=(self)" />
        {/* Force protocol detection for Safari */}
        <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
      </head>
      <body className="overflow-x-hidden bg-gray-50">
        {/* Server-side session fetch to avoid client auth race */}
        <SessionWrapper>
          <PostHogProvider>{children}</PostHogProvider>
        </SessionWrapper>
      </body>
    </html>
  )
}

// Async server component wrapper to fetch session and pass to client provider
async function SessionWrapper({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return <SessionProvider session={session ?? undefined}>{children}</SessionProvider>
}

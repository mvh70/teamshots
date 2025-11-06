import SessionProvider from '@/components/SessionProvider'
import { PostHogProvider } from '@/components/PostHogProvider'
import { auth } from '@/auth'
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { BRAND_CONFIG } from '@/config/brand'
import './globals.css'

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: BRAND_CONFIG.logo.icon, type: 'image/png' },
    ],
    apple: '/apple-icon.png',
    shortcut: '/favicon.ico',
  },
  referrer: 'strict-origin-when-cross-origin',
  other: {
    'format-detection': 'telephone=no',
    'apple-mobile-web-app-capable': 'yes',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
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
      <head>
        <meta httpEquiv="Permissions-Policy" content="camera=(self)" />
        {/* Force protocol detection for Safari */}
        <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
      </head>
      <body className="overflow-x-hidden bg-gray-50">
        <Script
          id="safari-compatibility-check"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Safari compatibility check
              if (typeof window !== 'undefined') {
                // Check for required features
                if (!window.Promise) {
                  console.error('Promise not supported - Safari version too old');
                }
              }
            `,
          }}
        />
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

import SessionProvider from '@/components/SessionProvider'
import { auth } from '@/auth'
import './globals.css'

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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta httpEquiv="Permissions-Policy" content="camera=(self)" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        {/* Safari-specific meta tags */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Force protocol detection for Safari */}
        <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
        <script
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
      </head>
      <body>
        {/* Server-side session fetch to avoid client auth race */}
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  )
}

// Async server component wrapper to fetch session and pass to client provider
async function SessionWrapper({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return <SessionProvider session={session ?? undefined}>{children}</SessionProvider>
}

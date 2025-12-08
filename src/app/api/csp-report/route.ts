import { NextRequest, NextResponse } from 'next/server'

/**
 * Content Security Policy (CSP) violation reporting endpoint
 * 
 * Receives CSP violation reports from browsers and logs them for monitoring.
 * This helps track security issues and inline script usage before migrating
 * to stricter CSP policies.
 */
export async function POST(request: NextRequest) {
  try {
    const report = await request.json()
    
    // Log CSP violations in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.warn('🔒 CSP Violation Report:', JSON.stringify(report, null, 2))
    }
    
    // In production, you might want to send this to a logging service
    // For now, we'll just acknowledge receipt
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to logging service (e.g., Sentry, LogRocket, DataDog)
      // Example: await sendToLoggingService(report)
      console.warn('CSP Violation:', report?.['csp-report']?.['violated-directive'])
    }
    
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Error processing CSP report:', error)
    return NextResponse.json({ error: 'Invalid report' }, { status: 400 })
  }
}

// Prevent caching of CSP reports
export const dynamic = 'force-dynamic'

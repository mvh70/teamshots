/**
 * Instrumentation - Runs once on server startup
 * Perfect for validation checks before serving any requests
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
    // Import and run startup validation
    const { validateEnvironment } = await import('./lib/startup-checks');
    validateEnvironment();
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError; 
/**
 * Instrumentation - Runs once on server startup
 * Perfect for validation checks before serving any requests
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import and run startup validation
    const { validateEnvironment } = await import('./lib/startup-checks')
    validateEnvironment()
  }
}

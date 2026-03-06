export function shouldBypassLocaleDetection(pathname: string): boolean {
  const normalizedPath = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname

  // Keep canonical English blog post URLs stable. If Spanish is unavailable,
  // the page layer redirects /es/blog/:slug back here, so locale auto-detection
  // must not bounce the request straight back to /es/blog/:slug.
  return /^\/blog\/[^/]+$/.test(normalizedPath)
}

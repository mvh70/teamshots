import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * On-demand ISR revalidation endpoint
 *
 * Called by the CMS after content is published/updated
 * to trigger Next.js to regenerate specific pages.
 *
 * Usage:
 *   POST /api/revalidate
 *   Headers: x-revalidate-secret: <secret>
 *   Body: { "paths": ["/blog/my-post", "/es/blog/mi-post"] }
 */
export async function POST(request: NextRequest) {
  // Validate secret
  const secret = request.headers.get('x-revalidate-secret');
  const expectedSecret = process.env.REVALIDATE_SECRET;

  if (!expectedSecret) {
    console.error('[Revalidate] REVALIDATE_SECRET not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  if (secret !== expectedSecret) {
    console.warn('[Revalidate] Invalid secret provided');
    return NextResponse.json(
      { error: 'Invalid secret' },
      { status: 401 }
    );
  }

  // Parse body
  let body: { paths?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { paths } = body;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json(
      { error: 'paths array is required' },
      { status: 400 }
    );
  }

  // Validate paths (basic security check)
  const allowedPrefixes = [
    '/blog',
    '/es/blog',
    '/solutions',
    '/es/soluciones',
    '/pricing',
    '/es/pricing',
    '/headshot-cost-calculator',
    '/es/headshot-cost-calculator',
  ] as const;

  const validPaths = paths.filter((path) => {
    if (typeof path !== 'string') return false;
    if (!path.startsWith('/')) return false;

    if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
      console.warn(`[Revalidate] Rejected invalid path: ${path}`);
      return false;
    }

    return true;
  });

  if (validPaths.length === 0) {
    return NextResponse.json(
      { error: 'No valid paths provided' },
      { status: 400 }
    );
  }

  // Revalidate each path
  const results: { path: string; success: boolean; error?: string }[] = [];

  for (const path of validPaths) {
    try {
      revalidatePath(path);
      results.push({ path, success: true });
      console.log(`[Revalidate] Revalidated: ${path}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({ path, success: false, error: errorMessage });
      console.error(`[Revalidate] Failed for ${path}:`, error);
    }
  }

  const allSucceeded = results.every((r) => r.success);

  return NextResponse.json({
    revalidated: results.filter((r) => r.success).map((r) => r.path),
    failed: results.filter((r) => !r.success),
    timestamp: new Date().toISOString(),
  }, {
    status: allSucceeded ? 200 : 207, // 207 = Multi-Status (partial success)
  });
}

// Also support GET for simple health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'revalidate',
    method: 'POST',
    required_header: 'x-revalidate-secret',
    body_format: '{ "paths": ["/blog/slug", ...] }',
  });
}

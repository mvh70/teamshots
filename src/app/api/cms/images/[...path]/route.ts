/**
 * CMS Image Serving API
 *
 * Serves images from the CMS volume (/app/data/images) in production
 * or from the teamshots-marketing/data/images directory in development.
 *
 * Routes:
 * - /api/cms/images/blog/slug.png → blog hero images
 * - /api/cms/images/solutions/accounting-after.webp → solution before/after images
 */
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

// Path to CMS images - production mounts volume at /app/data/images
// Development uses relative path to teamshots-marketing project
const CMS_IMAGES_PATH = process.env.CMS_IMAGES_PATH || path.join(process.cwd(), '..', 'teamshots-marketing', 'data', 'images')

// Content type mapping
const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const resolvedParams = await params
  const imagePath = path.join(CMS_IMAGES_PATH, ...resolvedParams.path)

  // Prevent path traversal
  const normalizedPath = path.normalize(imagePath)
  if (!normalizedPath.startsWith(path.normalize(CMS_IMAGES_PATH))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!existsSync(normalizedPath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const image = readFileSync(normalizedPath)
    const ext = path.extname(normalizedPath).slice(1).toLowerCase()
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(image, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Failed to read image:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

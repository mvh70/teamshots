import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { Logger } from '@/lib/logger'
import { validateImageFileByHeader } from '@/lib/file-validation'
import { auth } from '@/auth'
import { SecurityLogger } from '@/lib/security-logger'

const BASE_DIR = path.join(process.cwd(), 'storage', 'tmp')

// SECURITY: Allowed extensions for temp file uploads
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

async function ensureDir() {
  await fs.mkdir(BASE_DIR, { recursive: true })
}

/**
 * SECURITY: Validate temp filename to prevent path traversal attacks
 * - Rejects filenames with path separators or traversal sequences
 * - Validates resolved path is within BASE_DIR
 */
function validateTempFilename(fileName: string): { valid: boolean; error?: string } {
  // Check for path traversal patterns
  if (
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('..') ||
    fileName.includes('\0') ||
    fileName.includes('%2f') ||
    fileName.includes('%2F') ||
    fileName.includes('%5c') ||
    fileName.includes('%5C') ||
    fileName.includes('%2e%2e') ||
    fileName.includes('%00')
  ) {
    return { valid: false, error: 'Invalid filename: path traversal detected' }
  }

  // Validate the resolved path is within BASE_DIR
  const resolvedPath = path.resolve(BASE_DIR, fileName)
  if (!resolvedPath.startsWith(BASE_DIR + path.sep) && resolvedPath !== BASE_DIR) {
    return { valid: false, error: 'Invalid filename: path escape detected' }
  }

  return { valid: true }
}

/**
 * SECURITY: Validate file extension against allowlist
 */
function validateExtension(extension: string): boolean {
  const ext = extension.replace(/^\./, '').toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext)
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('x-file-content-type') || 'application/octet-stream'
    const extension = req.headers.get('x-file-extension') || ''

    // SECURITY: Validate extension against allowlist
    if (extension && !validateExtension(extension)) {
      return NextResponse.json({ error: 'Invalid file extension' }, { status: 400 })
    }

    const body = await req.arrayBuffer()
    // Validate file using shared utility (10MB max for this endpoint)
    const validation = validateImageFileByHeader(contentType, body.byteLength, 10 * 1024 * 1024)
    if (!validation.valid) {
      return validation.error!
    }

    await ensureDir()
    // SECURITY: Use crypto.randomUUID for unpredictable filenames instead of Math.random
    const fileName = `${Date.now()}-${crypto.randomUUID()}${extension ? `.${extension.replace(/^\./, '')}` : ''}`
    const filePath = path.join(BASE_DIR, fileName)
    await fs.writeFile(filePath, Buffer.from(body))

    // tempKey is a logical key the client can pass back
    const tempKey = `temp:${fileName}`
    return NextResponse.json({ tempKey })
  } catch (e) {
    Logger.error('[uploads/temp] POST error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Temp upload failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // SECURITY: Require authentication for temp file deletion
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key') || ''
    if (!key.startsWith('temp:')) return NextResponse.json({ ok: true })

    const fileName = key.slice('temp:'.length)

    // SECURITY: Validate filename to prevent path traversal
    const validation = validateTempFilename(fileName)
    if (!validation.valid) {
      await SecurityLogger.logSuspiciousActivity(
        session.user.id,
        'path_traversal_attempt',
        { endpoint: '/api/uploads/temp', fileName, key }
      )
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const filePath = path.join(BASE_DIR, fileName)
    try {
      await fs.unlink(filePath)
    } catch {
      // ignore missing
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    Logger.error('[uploads/temp] DELETE error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Temp delete failed' }, { status: 500 })
  }
}

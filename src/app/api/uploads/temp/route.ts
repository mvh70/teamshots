import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { Logger } from '@/lib/logger'
import { validateImageFileByHeader } from '@/lib/file-validation'

const BASE_DIR = path.join(process.cwd(), 'storage', 'tmp')

async function ensureDir() {
  await fs.mkdir(BASE_DIR, { recursive: true })
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('x-file-content-type') || 'application/octet-stream'
    const extension = req.headers.get('x-file-extension') || ''

    const body = await req.arrayBuffer()
    // Validate file using shared utility (10MB max for this endpoint)
    const validation = validateImageFileByHeader(contentType, body.byteLength, 10 * 1024 * 1024)
    if (!validation.valid) {
      return validation.error!
    }

    await ensureDir()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${extension ? `.${extension.replace(/^\./, '')}` : ''}`
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
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key') || ''
    if (!key.startsWith('temp:')) return NextResponse.json({ ok: true })
    const fileName = key.slice('temp:'.length)
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

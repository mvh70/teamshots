import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { SecurityLogger } from '@/lib/security-logger'
import { Env } from '@/lib/env'

const endpoint = Env.string('HETZNER_S3_ENDPOINT', '')
const bucket = Env.string('HETZNER_S3_BUCKET', '')
const accessKeyId = Env.string('HETZNER_S3_ACCESS_KEY', '')
const secretAccessKey = Env.string('HETZNER_S3_SECRET_KEY', '')
const region = Env.string('HETZNER_S3_REGION', 'eu-central')

const resolvedEndpoint = endpoint && (endpoint.startsWith('http://') || endpoint.startsWith('https://'))
  ? endpoint
  : endpoint
    ? `https://${endpoint}`
    : undefined

const s3 = new S3Client({
  region,
  endpoint: resolvedEndpoint,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || ''
  },
  forcePathStyle: false
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    
    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 })
    }

    if (!bucket) {
      return NextResponse.json({ error: 'S3 not configured' }, { status: 500 })
    }

    // SECURITY: Verify user has access to this file
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the file or has company access
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true, companyId: true }
    })

    if (!person) {
      return NextResponse.json({ error: 'User person record not found' }, { status: 404 })
    }

    // Extract personId from S3 key (format: folder/personId/filename)
    const keyParts = key.split('/')
    const filePersonId = keyParts[1]

    if (person.id !== filePersonId) {
      // Check if same company
      const filePerson = await prisma.person.findUnique({
        where: { id: filePersonId },
        select: { companyId: true }
      })
      
      if (!person.companyId || person.companyId !== filePerson?.companyId) {
        await SecurityLogger.logSuspiciousActivity(
          session.user.id,
          'unauthorized_file_access_attempt',
          { fileKey: key, fileOwnerId: filePersonId }
        )
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) // 1 hour expiry
    
    // Redirect to the signed URL so the browser can fetch/stream directly
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}

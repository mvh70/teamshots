import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    
    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
    }

    // Find selfie by key for the current user
    const selfie = await prisma.selfie.findFirst({
      where: { 
        key: key,
        person: { userId: session.user.id }
      },
      select: { id: true }
    })

    if (!selfie) {
      return NextResponse.json({ error: 'Selfie not found' }, { status: 404 })
    }

    return NextResponse.json({ id: selfie.id })
  } catch (e) {
    console.error('[uploads/find-by-key] error', e)
    return NextResponse.json({ error: 'Failed to find selfie' }, { status: 500 })
  }
}

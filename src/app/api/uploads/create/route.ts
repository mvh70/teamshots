import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'


export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { key } = body || {}
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

    // Find person for this user
    const person = await prisma.person.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    if (!person) return NextResponse.json({ error: 'No person for user' }, { status: 400 })

    const created = await prisma.selfie.create({ 
      data: { 
        key, 
        personId: person.id, 
        validated: true 
      } 
    })
    return NextResponse.json({ id: created.id })
  } catch (e) {
    Logger.error('[uploads/create] error', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: 'Failed to save upload' }, { status: 500 })
  }
}



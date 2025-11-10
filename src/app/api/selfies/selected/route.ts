import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'


export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token') || undefined

    // Resolve person: prioritize invite token when present (invite dashboard use-case)
    let personId: string | null = null
    if (token) {
      const invite = await prisma.teamInvite.findFirst({ where: { token, usedAt: { not: null } }, select: { personId: true } })
      personId = invite?.personId || null
    }
    // Fallback to session user when no valid token mapping
    if (!personId && session?.user?.id) {
      const person = await prisma.person.findUnique({ where: { userId: session.user.id }, select: { id: true } })
      personId = person?.id || null
    }

    if (!personId) {
      return NextResponse.json({ selfies: [] }, { status: 200 })
    }

    const selfies = await prisma.selfie.findMany({
      where: { personId, selected: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, key: true, selected: true, validated: true, createdAt: true }
    })

    return NextResponse.json({ selfies })
  } catch {
    return NextResponse.json({ selfies: [] }, { status: 200 })
  }
}

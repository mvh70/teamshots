import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ selfies: [] }, { status: 200 })
    }

    // Find current person's id
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    })

    if (!person?.id) {
      return NextResponse.json({ selfies: [] }, { status: 200 })
    }

    const selfies = await prisma.selfie.findMany({
      where: { personId: person.id, selected: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, key: true, selected: true, validated: true, createdAt: true }
    } as unknown as Parameters<typeof prisma.selfie.findMany>[0])

    return NextResponse.json({ selfies })
  } catch {
    return NextResponse.json({ selfies: [] }, { status: 200 })
  }
}

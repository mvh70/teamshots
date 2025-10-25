import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const uploads = await prisma.selfie.findMany({
      where: { person: { userId: session.user.id } },
      orderBy: { createdAt: 'desc' },
      select: { 
        id: true, 
        key: true, 
        validated: true, 
        createdAt: true,
        _count: {
          select: {
            generations: {
              where: {
                deleted: false
              }
            }
          }
        }
      }
    })

    const items = uploads.map((u: { 
      id: string; 
      key: string; 
      validated: boolean; 
      createdAt: Date; 
      _count: { generations: number }
    }) => ({
      id: u.id,
      uploadedKey: u.key,
      validated: u.validated,
      createdAt: u.createdAt.toISOString(),
      hasGenerations: u._count.generations > 0
    }))

    return NextResponse.json({ items })
  } catch (e) {
     
    console.error('[uploads/list] error', e)
    return NextResponse.json({ error: 'Failed to load uploads' }, { status: 500 })
  }
}



import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { buildDemographicsResponse } from '@/domain/person/demographics-handlers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const person = await prisma.person.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const payload = await buildDemographicsResponse(
    person.id,
    searchParams,
    'person-accessories',
    'person/demographics'
  )

  return NextResponse.json(payload)
}

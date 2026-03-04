import { NextRequest, NextResponse } from 'next/server'
import { Prisma, prisma } from '@/lib/prisma'
import { beautificationValueSchema, normalizeBeautificationValue } from '@/domain/style/elements/beautification/schema'

export async function getBeautificationDefaultsResponse(personId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { beautificationDefaults: true },
  })

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  const defaults = normalizeBeautificationValue(person.beautificationDefaults)
  return NextResponse.json({ defaults })
}

export async function putBeautificationDefaultsResponse(personId: string, request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = beautificationValueSchema.safeParse((body as { defaults?: unknown } | null)?.defaults ?? body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid beautification defaults', details: parsed.error.issues },
      { status: 400 }
    )
  }

  await prisma.person.update({
    where: { id: personId },
    data: {
      beautificationDefaults: parsed.data as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ defaults: parsed.data })
}

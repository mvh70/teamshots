import { prisma } from '@/lib/prisma'

export type Scope = 'individual' | 'pro' | 'freePackage'

export function deriveStyleName(scope: Scope, provided?: string | null): string {
  const trimmed = (provided ?? '').toString().trim()
  if (trimmed) return trimmed
  return scope === 'freePackage' ? 'Free Package Style' : 'unnamed'
}

export async function createOrUpdateStyleServer(params: {
  scope: Scope
  userId: string
  styleId?: string | null
  stylePreset: string
  settings: Record<string, unknown>
  name?: string | null
}): Promise<{ id: string }> {
  const effectiveName = deriveStyleName(params.scope, params.name)

  if (params.styleId) {
    const updated = await prisma.context.update({
      where: { id: params.styleId },
      data: {
        name: effectiveName,
        stylePreset: params.stylePreset,
        settings: params.settings as unknown as Parameters<typeof prisma.context.update>[0]['data']['settings']
      },
      select: { id: true }
    })
    return { id: updated.id }
  }

  const baseData = {
    name: effectiveName,
    stylePreset: params.stylePreset,
    settings: params.settings as unknown as Parameters<typeof prisma.context.create>[0]['data']['settings']
  }
  let dataToCreate: Parameters<typeof prisma.context.create>[0]['data'] = baseData
  if (params.scope === 'individual') {
    dataToCreate = { ...baseData, userId: params.userId }
  } else if (params.scope === 'pro') {
    const person = await prisma.person.findFirst({ where: { userId: params.userId }, select: { teamId: true } })
    if (person?.teamId) {
      dataToCreate = { ...baseData, teamId: person.teamId }
    }
  }
  const created = await prisma.context.create({ data: dataToCreate, select: { id: true } })
  return { id: created.id }
}

export async function setActiveStyleServer(params: { scope: Scope; userId: string; styleId: string }): Promise<void> {
  if (params.scope === 'freePackage') {
    await prisma.appSetting.upsert({
      where: { key: 'freePackageStyleId' },
      update: { value: params.styleId },
      create: { key: 'freePackageStyleId', value: params.styleId }
    })
    return
  }
  if (params.scope === 'pro') {
    const person = await prisma.person.findFirst({ where: { userId: params.userId }, select: { teamId: true } })
    if (person?.teamId) {
      await prisma.team.update({ where: { id: person.teamId }, data: { activeContextId: params.styleId } })
    }
  }
}



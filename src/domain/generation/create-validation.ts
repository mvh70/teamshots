import { prisma } from '@/lib/prisma'
import { getPackageConfig } from '@/domain/style/packages'
import { resolvePhotoStyleSettings } from '@/domain/style/settings-resolver'

const STYLE_CATEGORY_ALLOWLIST_BASE = new Set([
  'packageId',
  'presetId',
  'aspectRatio',
  'subjectCount',
  'usageContext',
  'style',
])

export async function resolveGenerationContextSettings(
  contextId: string | null | undefined
): Promise<{ resolvedContextId: string | null; contextStyleSettings: Record<string, unknown> | null }> {
  if (!contextId) {
    return { resolvedContextId: null, contextStyleSettings: null }
  }

  let context = await prisma.context.findUnique({
    where: { id: contextId },
    select: { id: true, settings: true },
  })

  if (!context) {
    context = await prisma.context.findFirst({
      where: { name: contextId },
      select: { id: true, settings: true },
    })
  }

  if (!context) {
    return { resolvedContextId: null, contextStyleSettings: null }
  }

  const settings =
    context.settings && typeof context.settings === 'object' && !Array.isArray(context.settings)
      ? (context.settings as Record<string, unknown>)
      : null

  return {
    resolvedContextId: context.id,
    contextStyleSettings: settings,
  }
}

export function findDisallowedStyleCategory(
  styleSettings: Record<string, unknown> | undefined,
  packageId: string
): string | null {
  if (!styleSettings) {
    return null
  }

  const packageConfig = getPackageConfig(packageId)
  const allowedCategories = new Set([
    ...packageConfig.visibleCategories,
    ...STYLE_CATEGORY_ALLOWLIST_BASE,
  ])

  for (const key of Object.keys(styleSettings)) {
    if (!allowedCategories.has(key)) {
      return key
    }
  }

  return null
}

export async function hasPackageAccess(
  userId: string | null | undefined,
  packageId: string
): Promise<boolean> {
  if (packageId === 'freepackage') {
    return true
  }

  if (!userId) {
    return false
  }

  const hasPackage = await prisma.userPackage.findFirst({
    where: {
      userId,
      packageId,
    },
    select: { id: true },
  })

  return Boolean(hasPackage)
}

export function resolveGenerationStyleSettings({
  packageId,
  contextStyleSettings,
  styleSettings,
}: {
  packageId: string
  contextStyleSettings: Record<string, unknown> | null
  styleSettings: Record<string, unknown> | undefined
}) {
  const packageConfig = getPackageConfig(packageId)
  const contextSettingsObj =
    contextStyleSettings && typeof contextStyleSettings === 'object'
      ? packageConfig.persistenceAdapter.deserialize(contextStyleSettings)
      : null
  const userModificationsObj = styleSettings ? packageConfig.extractUiSettings(styleSettings) : null

  return resolvePhotoStyleSettings(packageId, contextSettingsObj, userModificationsObj) as Record<string, unknown>
}

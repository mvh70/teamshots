import { getServerPackageConfig } from '@/domain/style/packages/server'
import { Logger } from '@/lib/logger'
import { PhotoStyleSettings } from '@/types/photo-style'

type RawSettings = Record<string, unknown>

export interface StyleResolutionInput {
  savedStyleSettings?: RawSettings | null
  contextSettings?: RawSettings | null
  jobStyleSettings?: RawSettings | null
  defaultPackageId?: string
}

export interface StyleResolutionResult {
  packageId: string
  stylePackage: ReturnType<typeof getServerPackageConfig>
  finalStyleSettings: PhotoStyleSettings
  mergedStyleSettings: PhotoStyleSettings
  jobShotType?: PhotoStyleSettings['shotType']
}

const DEFAULT_PACKAGE_ID = 'headshot1'

export function resolveStyleSettings({
  savedStyleSettings,
  contextSettings,
  jobStyleSettings,
  defaultPackageId = DEFAULT_PACKAGE_ID
}: StyleResolutionInput): StyleResolutionResult {
  const rawStyleSettings = pickRawStyleSettings(savedStyleSettings, contextSettings, jobStyleSettings)

  let packageId = extractPackageId(rawStyleSettings)
  if (!packageId && savedStyleSettings) {
    packageId = extractPackageId(savedStyleSettings)
  }
  if (!packageId && jobStyleSettings) {
    packageId = extractPackageId(jobStyleSettings)
  }
  packageId = packageId || defaultPackageId

  const stylePackage = getServerPackageConfig(packageId)
  const finalStyleSettings = stylePackage.persistenceAdapter.deserialize(rawStyleSettings) as PhotoStyleSettings
  const mergedStyleSettings = mergeJobOverrides(finalStyleSettings, jobStyleSettings)
  if (!finalStyleSettings.presetId) {
    finalStyleSettings.presetId = stylePackage.defaultPresetId
  }
  if (!mergedStyleSettings.presetId) {
    mergedStyleSettings.presetId = stylePackage.defaultPresetId
  }

  Logger.debug('Resolved style settings', {
    packageId,
    hasSavedSettings: Boolean(savedStyleSettings),
    hasContextSettings: Boolean(contextSettings),
    hasJobOverrides: Boolean(jobStyleSettings && Object.keys(jobStyleSettings).length > 0),
    shotType: mergedStyleSettings.shotType,
    aspectRatio: mergedStyleSettings.aspectRatio
  })

  return {
    packageId,
    stylePackage,
    finalStyleSettings,
    mergedStyleSettings,
    jobShotType: (jobStyleSettings?.shotType as PhotoStyleSettings['shotType']) || undefined
  }
}

function pickRawStyleSettings(
  savedStyleSettings?: RawSettings | null,
  contextSettings?: RawSettings | null,
  jobStyleSettings?: RawSettings | null
): RawSettings {
  if (isRecord(savedStyleSettings)) {
    Logger.debug('Using saved styleSettings from generation record')
    return savedStyleSettings
  }
  if (isRecord(contextSettings)) {
    Logger.debug('Using styleSettings from generation context')
    return contextSettings
  }
  if (isRecord(jobStyleSettings)) {
    Logger.debug('Using styleSettings from job payload')
    return jobStyleSettings
  }
  Logger.debug('No styleSettings provided, falling back to empty object')
  return {}
}

function extractPackageId(input: RawSettings | null | undefined): string | undefined {
  if (!isRecord(input)) return undefined
  const packageId = input.packageId
  return typeof packageId === 'string' ? packageId : undefined
}

function mergeJobOverrides(
  baseSettings: PhotoStyleSettings,
  jobStyleSettings?: RawSettings | null
): PhotoStyleSettings {
  if (!isRecord(jobStyleSettings)) {
    return baseSettings
  }

  const merged = { ...baseSettings } as Record<string, unknown>

  const branding = jobStyleSettings.branding as Record<string, unknown> | undefined
  if (isRecord(branding) && Object.keys(branding).length > 0) {
    merged.branding = { ...(merged.branding as Record<string, unknown> | undefined), ...branding }
  }

  const clothingColors = jobStyleSettings.clothingColors as Record<string, unknown> | undefined
  if (isRecord(clothingColors) && Object.keys(clothingColors).length > 0) {
    merged.clothingColors = clothingColors
  }

  const clothing = jobStyleSettings.clothing as Record<string, unknown> | undefined
  if (isRecord(clothing) && Object.keys(clothing).length > 0) {
    merged.clothing = { ...(merged.clothing as Record<string, unknown> | undefined), ...clothing }
  }

  const expression = jobStyleSettings.expression as Record<string, unknown> | undefined
  if (isRecord(expression) && Object.keys(expression).length > 0) {
    merged.expression = { ...(merged.expression as Record<string, unknown> | undefined), ...expression }
  }

  const background = jobStyleSettings.background as Record<string, unknown> | undefined
  if (isRecord(background) && Object.keys(background).length > 0) {
    merged.background = { ...(merged.background as Record<string, unknown> | undefined), ...background }
  }

  const jobShotType = jobStyleSettings.shotType as PhotoStyleSettings['shotType'] | undefined
  if (jobShotType?.type && jobShotType.type !== 'user-choice') {
    merged.shotType = { type: jobShotType.type }
    Logger.debug('Overriding shotType from job payload', { shotType: jobShotType.type })
  }

  const jobAspectRatio = jobStyleSettings.aspectRatio
  if (typeof jobAspectRatio === 'string' && jobAspectRatio.trim().length > 0) {
    merged.aspectRatio = jobAspectRatio
  }

  const jobFocalLength = jobStyleSettings.focalLength
  if (typeof jobFocalLength === 'string' && jobFocalLength.trim().length > 0) {
    merged.focalLength = jobFocalLength
  }

  const jobAperture = jobStyleSettings.aperture
  if (typeof jobAperture === 'string' && jobAperture.trim().length > 0) {
    merged.aperture = jobAperture
  }

  const jobLightingQuality = jobStyleSettings.lightingQuality
  if (typeof jobLightingQuality === 'string' && jobLightingQuality.trim().length > 0) {
    merged.lightingQuality = jobLightingQuality
  }

  const jobShutterSpeed = jobStyleSettings.shutterSpeed
  if (typeof jobShutterSpeed === 'string' && jobShutterSpeed.trim().length > 0) {
    merged.shutterSpeed = jobShutterSpeed
  }

  const jobBodyAngle = jobStyleSettings.bodyAngle
  if (typeof jobBodyAngle === 'string' && jobBodyAngle.trim().length > 0) {
    merged.bodyAngle = jobBodyAngle
  }

  const jobHeadPosition = jobStyleSettings.headPosition
  if (typeof jobHeadPosition === 'string' && jobHeadPosition.trim().length > 0) {
    merged.headPosition = jobHeadPosition
  }

  const jobShoulderPosition = jobStyleSettings.shoulderPosition
  if (typeof jobShoulderPosition === 'string' && jobShoulderPosition.trim().length > 0) {
    merged.shoulderPosition = jobShoulderPosition
  }

  const jobWeightDistribution = jobStyleSettings.weightDistribution
  if (typeof jobWeightDistribution === 'string' && jobWeightDistribution.trim().length > 0) {
    merged.weightDistribution = jobWeightDistribution
  }

  const jobArmPosition = jobStyleSettings.armPosition
  if (typeof jobArmPosition === 'string' && jobArmPosition.trim().length > 0) {
    merged.armPosition = jobArmPosition
  }

  const jobSittingPose = jobStyleSettings.sittingPose
  if (typeof jobSittingPose === 'string' && jobSittingPose.trim().length > 0) {
    merged.sittingPose = jobSittingPose
  }

  return merged as PhotoStyleSettings
}

function isRecord(value: unknown): value is RawSettings {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}


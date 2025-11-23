import {
  type ApertureSetting,
  type SubjectCountSetting,
  type UsageContextSetting,
  type FocalLengthSetting
} from '@/types/photo-style'
import {
  type CanonicalShotType,
  resolveAperture,
  resolveFocalLength
} from '../elements/shot-type/config'

type FocalLengthConfig = ReturnType<typeof resolveFocalLength>
type ApertureConfig = ReturnType<typeof resolveAperture>

export interface CriticalOverrideParams {
  presetId?: string
  shotType: CanonicalShotType
  subjectCount?: SubjectCountSetting
  usageContext?: UsageContextSetting
  baseBackgroundDistanceFt?: number
}

export interface CriticalOverrideResult {
  focalLength?: FocalLengthConfig
  aperture?: ApertureConfig
  subjectScalePercent?: number
  headroomPercent?: number
  backgroundDistanceFt?: number
}

const FOCAL_BY_SHOT: Record<CanonicalShotType, FocalLengthSetting> = {
  'extreme-close-up': '85mm',
  'close-up': '85mm',
  'medium-close-up': '85mm',
  'medium-shot': '85mm',
  'three-quarter': '70mm',
  'full-length': '50mm',
  'wide-shot': '35mm'
}

const SUBJECT_SCALE_BY_SHOT: Partial<Record<CanonicalShotType, number>> = {
  'extreme-close-up': 90,
  'close-up': 85,
  'medium-close-up': 80,
  'medium-shot': 80,
  'three-quarter': 75,
  'full-length': 75,
  'wide-shot': 50
}

const DEFAULT_HEADROOM = 10

const DEFAULT_BACKGROUND_DISTANCE_BY_SHOT: Partial<Record<CanonicalShotType, number>> = {
  'medium-close-up': 8,
  'medium-shot': 8,
  'three-quarter': 8,
  'full-length': 10,
  'wide-shot': 4
}

function resolveFocalLengthSetting(
  presetId: string | undefined,
  shotType: CanonicalShotType,
  subjectCount: SubjectCountSetting
): FocalLengthConfig {
  if (subjectCount === '9+') {
    return resolveFocalLength('35mm')
  }

  if (presetId === 'fashion-editorial' && shotType === 'full-length') {
    return resolveFocalLength('85mm')
  }

  return resolveFocalLength(FOCAL_BY_SHOT[shotType] ?? '85mm')
}

function resolveApertureSetting(
  presetId: string | undefined,
  shotType: CanonicalShotType,
  subjectCount: SubjectCountSetting
): ApertureConfig {
  if (presetId === 'fashion-editorial') {
    return resolveAperture('f/2.8')
  }

  const groupMapping: Record<Exclude<SubjectCountSetting, '1'>, ApertureSetting> = {
    '2-3': 'f/5.6',
    '4-8': 'f/8.0',
    '9+': 'f/11'
  }

  if (subjectCount !== '1') {
    return resolveAperture(groupMapping[subjectCount])
  }

  if (shotType === 'full-length') {
    return resolveAperture('f/5.6')
  }

  return resolveAperture('f/4.0')
}

function resolveSubjectScale(shotType: CanonicalShotType): number | undefined {
  return SUBJECT_SCALE_BY_SHOT[shotType]
}

function resolveHeadroom(
  presetId: string | undefined,
  usageContext: UsageContextSetting | undefined
): number {
  if (usageContext === 'social-media') {
    return 15
  }

  if (presetId === 'fashion-editorial') {
    return 5
  }

  return DEFAULT_HEADROOM
}

function resolveBackgroundDistance(
  presetId: string | undefined,
  shotType: CanonicalShotType,
  base: number | undefined
): number {
  const defaultDistance = DEFAULT_BACKGROUND_DISTANCE_BY_SHOT[shotType]
  let distance = base ?? defaultDistance ?? 8

  if (
    shotType === 'medium-close-up' ||
    shotType === 'medium-shot' ||
    shotType === 'three-quarter'
  ) {
    distance = Math.max(distance, 8)
  }

  if (shotType === 'full-length') {
    distance = Math.max(distance, 10)
  }

  if (shotType === 'wide-shot') {
    distance = Math.min(distance, 4)
  }

  if (presetId === 'fashion-editorial') {
    distance = Math.max(distance, 15)
  }

  return distance
}

export function computeCriticalOverrides({
  presetId,
  shotType,
  subjectCount,
  usageContext,
  baseBackgroundDistanceFt
}: CriticalOverrideParams): CriticalOverrideResult {
  const resolvedSubjectCount: SubjectCountSetting = subjectCount ?? '1'

  const focalLength = resolveFocalLengthSetting(presetId, shotType, resolvedSubjectCount)
  const aperture = resolveApertureSetting(presetId, shotType, resolvedSubjectCount)
  const subjectScalePercent = resolveSubjectScale(shotType)

  const headroomPercent = resolveHeadroom(presetId, usageContext)

  const backgroundDistanceFt = resolveBackgroundDistance(
    presetId,
    shotType,
    baseBackgroundDistanceFt
  )

  return {
    focalLength,
    aperture,
    subjectScalePercent,
    headroomPercent,
    backgroundDistanceFt
  }
}


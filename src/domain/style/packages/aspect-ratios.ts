export type AspectRatioId =
  | '9:16'
  | '4:5'
  | '3:4'
  | '2:3'
  | '1:1'
  | '3:2'
  | '4:3'
  | '5:4'
  | '16:9'
  | '21:9'

export interface AspectRatioConfig {
  id: AspectRatioId
  width: number
  height: number
}

export const ASPECT_RATIOS: Record<AspectRatioId, AspectRatioConfig> = {
  '9:16': { id: '9:16', width: 768, height: 1344 },
  '4:5': { id: '4:5', width: 896, height: 1152 },
  '3:4': { id: '3:4', width: 864, height: 1184 },
  '2:3': { id: '2:3', width: 832, height: 1248 },
  '1:1': { id: '1:1', width: 1024, height: 1024 },
  '3:2': { id: '3:2', width: 1248, height: 832 },
  '4:3': { id: '4:3', width: 1184, height: 864 },
  '5:4': { id: '5:4', width: 1152, height: 896 },
  '16:9': { id: '16:9', width: 1344, height: 768 },
  '21:9': { id: '21:9', width: 1536, height: 672 }
}

export const DEFAULT_ASPECT_RATIO: AspectRatioConfig = ASPECT_RATIOS['1:1']

const SHOT_TYPE_ASPECT_RATIO_MAP: Record<string, AspectRatioId> = {
  'extreme-close-up': '1:1',
  'close-up': '4:5',
  'medium-close-up': '3:4',
  'medium-shot': '3:4',
  'three-quarter': '3:4',
  'full-length': '9:16',
  'wide-shot': '16:9',
  headshot: '3:4',
  midchest: '3:4',
  'full-body': '9:16'
}

export function defaultAspectRatioForShot(shotType?: string): AspectRatioConfig {
  if (!shotType) {
    return DEFAULT_ASPECT_RATIO
  }
  const normalized = shotType.trim().toLowerCase()
  const id = SHOT_TYPE_ASPECT_RATIO_MAP[normalized]
  return id ? ASPECT_RATIOS[id] : DEFAULT_ASPECT_RATIO
}

export function resolveAspectRatio(
  shotType?: string,
  explicitRatio?: AspectRatioId
): AspectRatioConfig {
  if (explicitRatio && ASPECT_RATIOS[explicitRatio]) {
    return ASPECT_RATIOS[explicitRatio]
  }
  return defaultAspectRatioForShot(shotType)
}


import { prisma } from '@/lib/prisma'
import {
  type AccessoryDetections,
  type GlassesType,
  type FacialHairType,
  type JewelryType,
  type PiercingType,
  type TattooArea,
  isSelfieClassificationV2,
} from './selfie-types'

const CONFIDENCE_THRESHOLD = 0.7

interface SelfieWithClassification {
  classification: unknown | null
}

export interface AccessoryProfile {
  glasses?: { detected: boolean; type: GlassesType }
  facialHair?: { detected: boolean; type: FacialHairType }
  jewelry?: { detected: boolean; types: JewelryType[] }
  piercings?: { detected: boolean; types: PiercingType[] }
  tattoos?: { detected: boolean; areas: TattooArea[] }
}

function extractAccessories(selfie: SelfieWithClassification): AccessoryDetections | undefined {
  if (!selfie.classification || typeof selfie.classification !== 'object') {
    return undefined
  }

  if (!isSelfieClassificationV2(selfie.classification)) {
    return undefined
  }

  return selfie.classification.accessories
}

function hasValidConfidence(input: { confidence: number } | undefined): boolean {
  return Boolean(input && input.confidence >= CONFIDENCE_THRESHOLD)
}

function aggregateDetected(entries: Array<{ detected: boolean }>): boolean {
  const detectedCount = entries.filter((entry) => entry.detected).length
  return detectedCount > entries.length / 2
}

function aggregateSingleType<T extends string>(
  entries: Array<{ detected: boolean; type: T }>
): { detected: boolean; type: T } | undefined {
  if (entries.length === 0) return undefined

  const detected = aggregateDetected(entries)
  const detectedEntries = entries.filter((entry) => entry.detected)
  if (detectedEntries.length === 0) {
    return { detected, type: entries[0].type }
  }

  const counts = new Map<T, number>()
  for (const entry of detectedEntries) {
    counts.set(entry.type, (counts.get(entry.type) || 0) + 1)
  }

  const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? detectedEntries[0].type
  return { detected, type: mode }
}

function aggregateMultiType<T extends string>(
  entries: Array<{ detected: boolean; values: T[] }>
): { detected: boolean; values: T[] } | undefined {
  if (entries.length === 0) return undefined

  const detected = aggregateDetected(entries)
  const detectedEntries = entries.filter((entry) => entry.detected)
  const union = new Set<T>()
  for (const entry of detectedEntries) {
    for (const value of entry.values) {
      union.add(value)
    }
  }

  return { detected, values: [...union] }
}

export function aggregateAccessories(selfies: SelfieWithClassification[]): AccessoryProfile {
  if (selfies.length === 0) return {}

  const detections = selfies
    .map(extractAccessories)
    .filter((value): value is AccessoryDetections => Boolean(value))

  if (detections.length === 0) return {}

  const glassesEntries = detections
    .filter((detection) => hasValidConfidence(detection.glasses))
    .map((detection) => ({
      detected: detection.glasses!.detected,
      type: detection.glasses!.type,
    }))

  const facialHairEntries = detections
    .filter((detection) => hasValidConfidence(detection.facial_hair))
    .map((detection) => ({
      detected: detection.facial_hair!.detected,
      type: detection.facial_hair!.type,
    }))

  const jewelryEntries = detections
    .filter((detection) => hasValidConfidence(detection.jewelry))
    .map((detection) => ({
      detected: detection.jewelry!.detected,
      values: detection.jewelry!.types,
    }))

  const piercingsEntries = detections
    .filter((detection) => hasValidConfidence(detection.piercings))
    .map((detection) => ({
      detected: detection.piercings!.detected,
      values: detection.piercings!.types,
    }))

  const tattoosEntries = detections
    .filter((detection) => hasValidConfidence(detection.tattoos))
    .map((detection) => ({
      detected: detection.tattoos!.detected,
      values: detection.tattoos!.areas,
    }))

  const profile: AccessoryProfile = {}

  const glasses = aggregateSingleType(glassesEntries)
  if (glasses) profile.glasses = glasses

  const facialHair = aggregateSingleType(facialHairEntries)
  if (facialHair) profile.facialHair = facialHair

  const jewelry = aggregateMultiType(jewelryEntries)
  if (jewelry) profile.jewelry = { detected: jewelry.detected, types: jewelry.values }

  const piercings = aggregateMultiType(piercingsEntries)
  if (piercings) profile.piercings = { detected: piercings.detected, types: piercings.values }

  const tattoos = aggregateMultiType(tattoosEntries)
  if (tattoos) profile.tattoos = { detected: tattoos.detected, areas: tattoos.values }

  return profile
}

export async function getAccessoriesFromSelfieIds(
  ids: string[],
  options?: { personId?: string }
): Promise<AccessoryProfile> {
  if (ids.length === 0) return {}

  const selfies = await prisma.selfie.findMany({
    where: {
      id: { in: ids },
      ...(options?.personId && { personId: options.personId }),
    },
    select: { classification: true },
  })

  return aggregateAccessories(selfies)
}

export async function getAccessoriesFromSelfieKeys(
  keys: string[],
  options?: { personId?: string }
): Promise<AccessoryProfile> {
  if (keys.length === 0) return {}

  const selfies = await prisma.selfie.findMany({
    where: {
      key: { in: keys },
      ...(options?.personId && { personId: options.personId }),
    },
    select: { classification: true },
  })

  return aggregateAccessories(selfies)
}

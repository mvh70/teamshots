/**
 * Backfill script to populate the classification JSON column from existing column data.
 *
 * This script reads selfies that have classification data in individual columns
 * but no JSON classification, and populates the JSON column from those values.
 *
 * Run with: npx tsx scripts/backfill-selfie-classification.ts
 */

import { prisma } from '@/lib/prisma'
import type { SelfieClassification, SelfieType, QualityRating, Gender, AgeCategory, Ethnicity } from '@/domain/selfie/selfie-types'

const BATCH_SIZE = 100
const DEFAULT_CONFIDENCE = 0.5 // For backfilled demographics without confidence data

interface SelfieWithColumns {
  id: string
  selfieType: string | null
  selfieTypeConfidence: number | null
  personCount: number | null
  isProper: boolean | null
  improperReason: string | null
  lightingQuality: string | null
  lightingFeedback: string | null
  backgroundQuality: string | null
  backgroundFeedback: string | null
  gender: string | null
  ageCategory: string | null
  ethnicity: string | null
  classification: unknown | null
}

function buildClassificationJson(selfie: SelfieWithColumns): SelfieClassification | null {
  // Skip if no type data
  if (!selfie.selfieType) {
    return null
  }

  const classification: SelfieClassification = {
    version: 1,
    type: {
      value: selfie.selfieType as SelfieType,
      confidence: selfie.selfieTypeConfidence ?? 0,
    },
    personCount: selfie.personCount ?? 1,
    proper: {
      isProper: selfie.isProper ?? false,
      reason: selfie.improperReason ?? undefined,
    },
    lighting: {
      quality: (selfie.lightingQuality as QualityRating) ?? 'acceptable',
      feedback: selfie.lightingFeedback ?? undefined,
    },
    background: {
      quality: (selfie.backgroundQuality as QualityRating) ?? 'acceptable',
      feedback: selfie.backgroundFeedback ?? undefined,
    },
    demographics: {},
  }

  // Only include demographics if we have valid data (not 'unknown')
  if (selfie.gender && selfie.gender !== 'unknown') {
    classification.demographics.gender = {
      value: selfie.gender as Exclude<Gender, 'unknown'>,
      confidence: DEFAULT_CONFIDENCE, // No confidence data for backfilled records
    }
  }

  if (selfie.ageCategory && selfie.ageCategory !== 'unknown') {
    classification.demographics.ageCategory = {
      value: selfie.ageCategory as Exclude<AgeCategory, 'unknown'>,
      confidence: DEFAULT_CONFIDENCE,
    }
  }

  if (selfie.ethnicity && selfie.ethnicity !== 'unknown') {
    classification.demographics.ethnicity = {
      value: selfie.ethnicity as Exclude<Ethnicity, 'unknown'>,
      confidence: DEFAULT_CONFIDENCE,
    }
  }

  return classification
}

async function backfillClassifications(): Promise<void> {
  console.log('Starting classification backfill...')

  let processed = 0
  let updated = 0
  let skipped = 0
  let cursor: string | undefined

  while (true) {
    // Fetch batch of selfies that have column data but no JSON classification
    const selfies = await prisma.selfie.findMany({
      where: {
        selfieType: { not: null },
        classification: null,
      },
      select: {
        id: true,
        selfieType: true,
        selfieTypeConfidence: true,
        personCount: true,
        isProper: true,
        improperReason: true,
        lightingQuality: true,
        lightingFeedback: true,
        backgroundQuality: true,
        backgroundFeedback: true,
        gender: true,
        ageCategory: true,
        ethnicity: true,
        classification: true,
      },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
    })

    if (selfies.length === 0) {
      break
    }

    // Process batch
    for (const selfie of selfies) {
      const classificationJson = buildClassificationJson(selfie)

      if (classificationJson) {
        await prisma.selfie.update({
          where: { id: selfie.id },
          data: { classification: classificationJson },
        })
        updated++
      } else {
        skipped++
      }

      processed++
    }

    console.log(`Processed ${processed} selfies (updated: ${updated}, skipped: ${skipped})`)

    // Move cursor
    cursor = selfies[selfies.length - 1].id
  }

  console.log(`\nBackfill complete!`)
  console.log(`Total processed: ${processed}`)
  console.log(`Updated with JSON: ${updated}`)
  console.log(`Skipped (no data): ${skipped}`)
}

// Run the backfill
backfillClassifications()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })

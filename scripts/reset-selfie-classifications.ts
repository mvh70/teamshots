#!/usr/bin/env tsx
/**
 * Reset selfie type classifications so they get re-classified with updated AI prompt
 * 
 * Usage: npx tsx scripts/reset-selfie-classifications.ts
 */

import { config } from 'dotenv'
config() // Load .env file

import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('Resetting selfie type classifications...')
  
  const result = await prisma.selfie.updateMany({
    where: {
      // Reset all selfies that have been classified OR have empty strings
      OR: [
        { selfieType: { not: null } },
        { selfieType: '' }
      ]
    },
    data: {
      selfieType: null,
      selfieTypeConfidence: null,
      personCount: null,
      isProper: null,
      improperReason: null
    }
  })
  
  console.log(`✅ Reset ${result.count} selfies. They will be re-classified automatically.`)
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })

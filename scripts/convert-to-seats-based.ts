/**
 * Convert your test team to seats-based pricing model
 * Run with: npx tsx scripts/convert-to-seats-based.ts
 */

import { prisma } from '../src/lib/prisma'

async function convertToSeatsModel() {
  const email = process.env.TEST_USER_EMAIL || 'your-email@example.com'
  
  console.log(`Converting user ${email} to seats-based model...`)
  
  // 1. Update user's signup domain and plan period
  const user = await prisma.user.update({
    where: { email },
    data: {
      signupDomain: 'teamshotspro.com',
      planTier: 'pro',
      planPeriod: 'seats', // CRITICAL: This is what the sidebar checks!
      subscriptionStatus: 'active'
    },
    include: {
      person: {
        include: {
          team: true
        }
      }
    }
  })
  
  console.log(`✓ Updated user:`)
  console.log(`  - signupDomain: teamshotspro.com`)
  console.log(`  - planTier: pro`)
  console.log(`  - planPeriod: seats`)
  console.log(`  - subscriptionStatus: active`)
  
  // 2. Update team to seats-based model
  if (user.person?.teamId) {
    await prisma.team.update({
      where: { id: user.person.teamId },
      data: {
        isLegacyCredits: false,
        totalSeats: 10,      // Set to 10 seats for testing
        activeSeats: 1,      // Admin occupies 1 seat
        creditsPerSeat: 100  // 100 credits per seat (10 photos)
      }
    })
    console.log(`✓ Updated team to seats-based model:`)
    console.log(`  - Total seats: 10`)
    console.log(`  - Active seats: 1`)
    console.log(`  - Credits per seat: 100`)
  } else {
    console.log(`⚠️  User has no team yet`)
  }
  
  console.log(`\n✅ Conversion complete! Refresh your browser at /app/team to see changes.`)
}

convertToSeatsModel()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })


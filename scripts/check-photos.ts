import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function main() {
  const personId = process.argv[2] // Get personId from command line argument

  if (!personId) {
    console.error('❌ Please provide a personId as argument')
    console.log('Usage: npx tsx scripts/check-photos.ts <personId>')
    process.exit(1)
  }

  // Count credit transactions
  const creditTxs = await prisma.creditTransaction.findMany({
    where: {
      personId,
      type: { in: ['generation', 'refund'] }
    },
    select: { type: true, credits: true }
  })

  const generationCredits = creditTxs
    .filter(tx => tx.type === 'generation')
    .reduce((sum, tx) => sum + Math.abs(tx.credits), 0)

  const refundCredits = creditTxs
    .filter(tx => tx.type === 'refund')
    .reduce((sum, tx) => sum + tx.credits, 0)

  const netCredits = generationCredits - refundCredits
  const photosFromCredits = netCredits / 10

  // Count actual generations
  const generations = await prisma.generation.count({
    where: {
      personId,
      deleted: false,
      status: { not: 'failed' }
    }
  })

  console.log('\n📊 Photo Usage Comparison')
  console.log('─'.repeat(50))
  console.log(`Person ID: ${personId}`)
  console.log('─'.repeat(50))
  console.log(`Generation Credits Used: ${generationCredits} (${generationCredits/10} photos)`)
  console.log(`Refund Credits:          ${refundCredits} (${refundCredits/10} photos)`)
  console.log(`Net Credits Used:        ${netCredits} (${photosFromCredits} photos)`)
  console.log(`─`.repeat(50))
  console.log(`Actual Generation Records: ${generations} photos`)
  console.log(`─`.repeat(50))
  console.log(`Difference: ${Math.abs(photosFromCredits - generations)} photos ${photosFromCredits > generations ? '(more credits than generations)' : '(more generations than credits)'}`)
  console.log('─'.repeat(50))

  if (photosFromCredits !== generations) {
    console.log('\n💡 Why might these differ?')
    console.log('  - Failed generations that deducted credits')
    console.log('  - Deleted generations (credits deducted but generation removed)')
    console.log('  - Regenerations counted differently')
    console.log('  - Refunds not fully processed')
  } else {
    console.log('\n✅ Perfect match! Credits and generations align.')
  }
  console.log('')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

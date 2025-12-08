const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const generationId = process.argv[2] || 'cmiulujsp0009dqy6warhz3kw'
  
  const costs = await prisma.costGeneration.findMany({
    where: {
      generationId: generationId
    },
    orderBy: {
      createdAt: 'asc'
    },
    select: {
      id: true,
      stepName: true,
      reason: true,
      result: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      imagesGenerated: true,
      estimatedCost: true,
      createdAt: true
    }
  })
  
  console.log(`\nCost records for generation ${generationId}:\n`)
  console.log('Total records:', costs.length)
  console.log('\nDetailed records:\n')
  costs.forEach((cost, idx) => {
    console.log(`${idx + 1}. ${cost.stepName} (${cost.reason})`)
    console.log(`   Model: ${cost.model}`)
    console.log(`   Tokens: ${cost.inputTokens} in / ${cost.outputTokens} out`)
    console.log(`   Images: ${cost.imagesGenerated || 0}`)
    console.log(`   Cost: $${cost.estimatedCost}`)
    console.log(`   Time: ${cost.createdAt.toISOString()}`)
    console.log('')
  })
  
  const totalCost = costs.reduce((sum, c) => sum + parseFloat(c.estimatedCost.toString()), 0)
  console.log(`Total estimated cost: $${totalCost.toFixed(6)}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())


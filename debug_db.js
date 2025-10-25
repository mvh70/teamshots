const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkData() {
  try {
    // Check total generations
    const generationCount = await prisma.generation.count({
      where: { deleted: false }
    })
    
    // Check total credit transactions
    const creditTransactions = await prisma.creditTransaction.aggregate({
      _sum: { amount: true },
      _count: { id: true }
    })
    
    // Check user data
    const users = await prisma.user.findMany({
      include: {
        person: {
          include: {
            company: true,
            _count: {
              select: {
                generations: true,
                selfies: true
              }
            }
          }
        }
      }
    })
    
    console.log('=== Database Summary ===')
    console.log(`Total generations: ${generationCount}`)
    console.log(`Total credit transactions: ${creditTransactions._count.id}`)
    console.log(`Total credit amount: ${creditTransactions._sum.amount || 0}`)
    console.log('\n=== Users ===')
    
    users.forEach(user => {
      console.log(`User: ${user.email}`)
      console.log(`  Person: ${user.person ? 'Yes' : 'No'}`)
      if (user.person) {
        console.log(`  Company: ${user.person.company?.name || 'None'}`)
        console.log(`  Generations: ${user.person._count.generations}`)
        console.log(`  Selfies: ${user.person._count.selfies}`)
      }
      console.log('')
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkData()

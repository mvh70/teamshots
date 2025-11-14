import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixCredits() {
  try {
    const userEmail = process.argv[2] || 'mvh.aperen70@gmail.com'
    
    console.log(`\n=== Fixing credits for: ${userEmail} ===\n`)

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        person: true
      }
    })

    if (!user) {
      console.error(`User not found: ${userEmail}`)
      process.exit(1)
    }

    console.log(`User ID: ${user.id}`)
    console.log(`Person ID: ${user.person?.id || 'None'}\n`)

    // Find transactions with personId but no userId
    const transactionsToFix = await prisma.creditTransaction.findMany({
      where: {
        personId: user.person?.id,
        userId: null,
        credits: { gt: 0 } // Only positive credits (grants)
      }
    })

    console.log(`Found ${transactionsToFix.length} transactions to fix:\n`)

    if (transactionsToFix.length === 0) {
      console.log('No transactions need fixing!')
      return
    }

    transactionsToFix.forEach((tx, idx) => {
      console.log(`Transaction ${idx + 1}:`)
      console.log(`  ID: ${tx.id}`)
      console.log(`  Credits: ${tx.credits}`)
      console.log(`  Type: ${tx.type}`)
      console.log(`  Description: ${tx.description || 'N/A'}`)
      console.log(`  PersonId: ${tx.personId}`)
      console.log(`  UserId: ${tx.userId || 'NULL (needs fixing)'}`)
      console.log('')
    })

    // Update transactions to include userId
    console.log('Updating transactions...\n')
    
    const updateResult = await prisma.creditTransaction.updateMany({
      where: {
        personId: user.person?.id,
        userId: null,
        credits: { gt: 0 }
      },
      data: {
        userId: user.id
      }
    })

    console.log(`Updated ${updateResult.count} transactions\n`)

    // Verify the fix - calculate balance manually
    const balanceResult = await prisma.creditTransaction.aggregate({
      where: { userId: user.id },
      _sum: { credits: true }
    })
    const newBalance = balanceResult._sum.credits || 0
    
    console.log(`=== Verification ===`)
    console.log(`New Individual Balance: ${newBalance}`)
    
    // Also check person balance
    const personResult = await prisma.creditTransaction.aggregate({
      where: { personId: user.person?.id },
      _sum: { credits: true }
    })
    console.log(`Person Balance: ${personResult._sum.credits || 0}`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixCredits()


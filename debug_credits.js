import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugCredits() {
  try {
    // Get user email from command line args or use a default
    const userEmail = process.argv[2] || process.env.USER_EMAIL
    
    if (!userEmail) {
      console.error('Usage: node debug_credits.js <user-email>')
      console.error('Or set USER_EMAIL environment variable')
      process.exit(1)
    }

    console.log(`\n=== Debugging credits for: ${userEmail} ===\n`)

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        person: {
          include: {
            team: true
          }
        }
      }
    })

    if (!user) {
      console.error(`User not found: ${userEmail}`)
      process.exit(1)
    }

    console.log(`User ID: ${user.id}`)
    console.log(`Plan Tier: ${user.planTier || 'null'}`)
    console.log(`Plan Period: ${user.planPeriod || 'null'}`)
    console.log(`Has Person: ${user.person ? 'Yes' : 'No'}`)
    if (user.person) {
      console.log(`Person ID: ${user.person.id}`)
      console.log(`Team ID: ${user.person.teamId || 'None'}`)
      if (user.person.team) {
        console.log(`Team Name: ${user.person.team.name}`)
        console.log(`Team Admin ID: ${user.person.team.adminId}`)
      }
    }
    console.log('')

    // Get ALL credit transactions for this user
    const allTransactions = await prisma.creditTransaction.findMany({
      where: {
        OR: [
          { userId: user.id },
          { personId: user.person?.id },
          { teamId: user.person?.teamId }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`=== All Credit Transactions (${allTransactions.length} total) ===\n`)
    
    if (allTransactions.length === 0) {
      console.log('No credit transactions found!')
    } else {
      allTransactions.forEach((tx, idx) => {
        console.log(`Transaction ${idx + 1}:`)
        console.log(`  ID: ${tx.id}`)
        console.log(`  Credits: ${tx.credits}`)
        console.log(`  Type: ${tx.type}`)
        console.log(`  Description: ${tx.description || 'N/A'}`)
        console.log(`  UserId: ${tx.userId || 'null'}`)
        console.log(`  PersonId: ${tx.personId || 'null'}`)
        console.log(`  TeamId: ${tx.teamId || 'null'}`)
        console.log(`  PlanTier: ${tx.planTier || 'null'}`)
        console.log(`  PlanPeriod: ${tx.planPeriod || 'null'}`)
        console.log(`  Created: ${tx.createdAt}`)
        console.log('')
      })
    }

    // Calculate balances using the same logic as the code
    console.log('=== Balance Calculations ===\n')

    // Individual balance (getUserCreditBalance)
    const individualResult = await prisma.creditTransaction.aggregate({
      where: { userId: user.id },
      _sum: { credits: true }
    })
    const individualBalance = individualResult._sum.credits || 0
    console.log(`Individual Balance (userId=${user.id}): ${individualBalance}`)

    // Team balance (if user has team)
    if (user.person?.teamId) {
      const teamResult = await prisma.creditTransaction.aggregate({
        where: { teamId: user.person.teamId },
        _sum: { credits: true }
      })
      const teamBalance = teamResult._sum.credits || 0
      console.log(`Team Balance (teamId=${user.person.teamId}): ${teamBalance}`)

      // Effective team balance (includes unmigrated pro credits)
      const subscription = await prisma.subscriptionChange.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      })
      
      const hasProTier = user.planTier === 'pro'
      console.log(`Has Pro Tier: ${hasProTier}`)
      
      if (hasProTier) {
        const proResult = await prisma.creditTransaction.aggregate({
          where: {
            userId: user.id,
            planTier: 'pro',
            teamId: null,
            credits: { gt: 0 }
          },
          _sum: { credits: true }
        })
        const unmigratedCredits = proResult._sum.credits || 0
        console.log(`Unmigrated Pro Credits: ${unmigratedCredits}`)
        console.log(`Effective Team Balance: ${teamBalance + unmigratedCredits}`)
      }
    }

    // Person balance
    if (user.person) {
      const personResult = await prisma.creditTransaction.aggregate({
        where: { personId: user.person.id },
        _sum: { credits: true }
      })
      const personBalance = personResult._sum.credits || 0
      console.log(`Person Balance (personId=${user.person.id}): ${personBalance}`)
    }

    console.log('\n=== Summary ===')
    console.log(`Individual credits shown in dashboard: ${individualBalance}`)
    console.log(`Team credits shown in dashboard: ${user.person?.teamId ? (await prisma.creditTransaction.aggregate({
      where: { teamId: user.person.teamId },
      _sum: { credits: true }
    }))._sum.credits || 0 : 0}`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugCredits()


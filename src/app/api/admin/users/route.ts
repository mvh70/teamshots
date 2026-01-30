import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateActiveSeats } from '@/domain/pricing/seats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface UserData {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  signupDate: Date
  planTier: string | null
  planPeriod: string | null
  totalCredits: number
  creditBreakdown: Array<{
    type: string
    credits: number
  }>
  packages: Array<{
    packageId: string
    purchasedAt: Date | null
  }>
  // Team info for pro plan users
  team?: {
    id: string
    name: string | null
    totalSeats: number
    activeSeats: number
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all users with their person info, credits, and packages
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
        planTier: true,
        planPeriod: true,
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        teams: {
          select: {
            id: true,
            name: true,
            totalSeats: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Fetch credit transactions in parallel with user packages
    // Note: Credits belong to Person (business entity), not User (auth entity)
    const personIds = users.map(u => u.person?.id).filter((id): id is string => !!id)

    type PrismaWithUserPackage = typeof prisma & {
      userPackage: {
        findMany: (...args: unknown[]) => Promise<Array<{
          userId: string
          packageId: string
          purchasedAt: Date | null
        }>>
      }
    }
    const prismaEx = prisma as unknown as PrismaWithUserPackage

    const [creditTransactions, userPackages] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: {
          personId: { in: personIds }
        },
        select: {
          personId: true,
          credits: true,
          type: true
        }
      }),
      prismaEx.userPackage.findMany({
        where: {
          userId: { in: users.map(u => u.id) }
        },
        select: {
          userId: true,
          packageId: true,
          purchasedAt: true
        }
      })
    ])

    // Group credits by personId (credits belong to Person, not User)
    const creditsByPersonId = new Map<string, Array<{ type: string; credits: number }>>()
    for (const tx of creditTransactions) {
      if (!tx.personId) continue
      if (!creditsByPersonId.has(tx.personId)) {
        creditsByPersonId.set(tx.personId, [])
      }
      creditsByPersonId.get(tx.personId)!.push({
        type: tx.type,
        credits: tx.credits
      })
    }

    // Group packages by user
    const packagesByUser = new Map<string, Array<{ packageId: string; purchasedAt: Date | null }>>()
    for (const pkg of userPackages) {
      if (!packagesByUser.has(pkg.userId)) {
        packagesByUser.set(pkg.userId, [])
      }
      packagesByUser.get(pkg.userId)!.push({
        packageId: pkg.packageId,
        purchasedAt: pkg.purchasedAt
      })
    }

    // Calculate active seats dynamically for all teams
    const teamIds = users.map(u => u.teams[0]?.id).filter((id): id is string => !!id)
    const activeSeatsMap = new Map<string, number>()
    await Promise.all(
      teamIds.map(async (teamId) => {
        activeSeatsMap.set(teamId, await calculateActiveSeats(teamId))
      })
    )

    // Combine all data
    const userData: UserData[] = users.map(u => {
      const person = u.person
      // Use personId to look up credits (credits belong to Person, not User)
      const credits = person?.id ? creditsByPersonId.get(person.id) || [] : []
      const totalCredits = credits.reduce((sum, c) => sum + c.credits, 0)

      // Aggregate credits by type
      const creditBreakdown = credits.reduce((acc, c) => {
        const existing = acc.find(item => item.type === c.type)
        if (existing) {
          existing.credits += c.credits
        } else {
          acc.push({ type: c.type, credits: c.credits })
        }
        return acc
      }, [] as Array<{ type: string; credits: number }>)

      // Get team info (first team where user is admin)
      const team = u.teams[0] ? {
        id: u.teams[0].id,
        name: u.teams[0].name,
        totalSeats: u.teams[0].totalSeats,
        activeSeats: activeSeatsMap.get(u.teams[0].id) ?? 0
      } : undefined

      return {
        id: u.id,
        email: u.email,
        firstName: person?.firstName || null,
        lastName: person?.lastName || null,
        signupDate: u.createdAt,
        planTier: u.planTier,
        planPeriod: u.planPeriod,
        totalCredits,
        creditBreakdown,
        packages: packagesByUser.get(u.id) || [],
        team
      }
    })

    return NextResponse.json({
      users: userData,
      count: userData.length
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

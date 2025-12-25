import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Fetch credit transactions in parallel with user packages
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
          userId: { in: users.map(u => u.id) }
        },
        select: {
          userId: true,
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

    // Group credits by user
    const creditsByUser = new Map<string, Array<{ type: string; credits: number }>>()
    for (const tx of creditTransactions) {
      if (!tx.userId) continue
      if (!creditsByUser.has(tx.userId)) {
        creditsByUser.set(tx.userId, [])
      }
      creditsByUser.get(tx.userId)!.push({
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

    // Combine all data
    const userData: UserData[] = users.map(u => {
      const person = u.person
      const credits = creditsByUser.get(u.id) || []
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
        packages: packagesByUser.get(u.id) || []
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

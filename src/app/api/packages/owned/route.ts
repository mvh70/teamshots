import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { PACKAGES_CONFIG } from '@/config/packages'
import { getPackageConfig } from '@/domain/style/packages'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    type PrismaWithUserPackage = typeof prisma & { 
      userPackage: { 
        findMany: (...args: unknown[]) => Promise<Array<{ packageId: string; purchasedAt: Date | null; createdAt: Date }>> 
      } 
    }
    const prismaEx = prisma as unknown as PrismaWithUserPackage

    // Get user's owned packages
    const userPackages = await prismaEx.userPackage.findMany({
      where: { userId: session.user.id },
      select: {
        packageId: true,
        purchasedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    })

    // Enrich with package metadata
    type UserPackage = typeof userPackages[number];
    const packagesWithMetadata = userPackages.map((up: UserPackage) => {
      const packageConfig = getPackageConfig(up.packageId)
      const packageMetadata = PACKAGES_CONFIG.active[up.packageId as keyof typeof PACKAGES_CONFIG.active]
      
      return {
        packageId: up.packageId,
        name: packageMetadata?.name || packageConfig.label,
        description: packageMetadata?.description || '',
        label: packageConfig.label,
        purchasedAt: up.purchasedAt,
        createdAt: up.createdAt,
        visibleCategories: packageConfig.visibleCategories
      }
    })

    return NextResponse.json({
      packages: packagesWithMetadata,
      count: packagesWithMetadata.length
    })
  } catch (error) {
    console.error('Error fetching owned packages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch packages' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { PACKAGES_CONFIG } from '@/config/packages'
import { getPackageConfig } from '@/domain/style/packages'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const grantPackageSchema = z.object({
  userId: z.string().min(1),
  packageId: z.string().min(1)
})

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const validatedData = grantPackageSchema.parse(body)
    const { userId, packageId } = validatedData

    // Validate package exists
    const packageConfig = getPackageConfig(packageId)
    if (!packageConfig || packageConfig.id !== packageId) {
      return NextResponse.json(
        { error: 'Invalid package ID' },
        { status: 400 }
      )
    }

    // Validate user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Grant package (idempotent - check first, then create if doesn't exist)
    type PrismaWithUserPackage = typeof prisma & { 
      userPackage: { 
        findFirst: (...args: unknown[]) => Promise<{ id: string } | null>
        create: (...args: unknown[]) => Promise<unknown>
        update: (...args: unknown[]) => Promise<unknown>
      } 
    }
    const prismaEx = prisma as unknown as PrismaWithUserPackage

    const existing = await prismaEx.userPackage.findFirst({
      where: { userId, packageId }
    })

    if (existing) {
      // Already exists, update purchasedAt if it's null
      await prismaEx.userPackage.update({
        where: { id: existing.id },
        data: { purchasedAt: new Date() }
      })
    } else {
      // Create new
      await prismaEx.userPackage.create({
        data: {
          userId,
          packageId,
          purchasedAt: new Date()
        }
      })
    }

    const packageMetadata = PACKAGES_CONFIG.active[packageId as keyof typeof PACKAGES_CONFIG.active]

    return NextResponse.json({
      success: true,
      package: {
        packageId,
        name: packageMetadata?.name || packageConfig.label,
        description: packageMetadata?.description || ''
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error granting package:', error)
    return NextResponse.json(
      { error: 'Failed to grant package' },
      { status: 500 }
    )
  }
}


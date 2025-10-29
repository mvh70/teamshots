import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            company: {
              include: {
                contexts: {
                  where: { 
                    companyId: { not: null },
                    userId: null // Only company contexts
                  },
                  orderBy: { createdAt: 'desc' }
                },
                activeContext: true
              }
            }
          }
        }
      }
    })

    const companyId = (user as { person?: { company?: { id: string } } })?.person?.company?.id || null

    if (!companyId) {
      return NextResponse.json({ 
        error: 'User is not part of a company',
        contexts: [],
        activeContext: null,
        contextType: 'company'
      })
    }

    // Return company contexts
    const companyData = (user as { person?: { company?: { contexts: unknown[]; activeContext: unknown } } })?.person?.company
    const companyContexts = (companyData as { contexts: unknown[] }).contexts || []
    const companyActive = (companyData as { activeContext: unknown }).activeContext || null

    return NextResponse.json({
      contexts: companyContexts,
      activeContext: companyActive,
      contextType: 'company'
    })

  } catch (error) {
    Logger.error('Error fetching team contexts', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Generations Counts API Endpoint
 *
 * Returns per-person generation counts for folder view
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-middleware'
import { internalError } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { UserService } from '@/domain/services/UserService'

export async function GET() {
  try {
    // Get user session
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId: sessionUserId } = authResult

    // Get user context
    const userContext = await UserService.getUserContext(sessionUserId)
    const roles = userContext.roles
    const userTeamId = userContext.teamId

    // Build where clause based on roles (same logic as list endpoint)
    let where: Record<string, unknown> = {}

    if (roles.isTeamAdmin || roles.isTeamMember) {
      if (!userTeamId) {
        return NextResponse.json({ error: 'Not part of a team' }, { status: 403 })
      }
      if (roles.isTeamAdmin) {
        where = {
          person: {
            teamId: userTeamId
          }
        }
      } else {
        where = {
          person: {
            userId: sessionUserId,
            teamId: userTeamId
          }
        }
      }
    } else {
      where = {
        person: {
          userId: sessionUserId,
          teamId: null
        }
      }
    }

    // Exclude failed and deleted
    where.status = { notIn: ['failed', 'deleted'] }
    where.deleted = false

    // Get counts grouped by person
    const counts = await prisma.generation.groupBy({
      by: ['personId'],
      where: where,
      _count: {
        id: true
      }
    })

    // Create a map of personId -> count
    const countMap = new Map(counts.map(c => [c.personId, c._count.id]))

    // Get ALL team members (not just those with generations)
    let personWhere: Record<string, unknown> = {}
    if (roles.isTeamAdmin || roles.isTeamMember) {
      if (roles.isTeamAdmin) {
        // Admin sees all team members
        personWhere = { teamId: userTeamId }
      } else {
        // Regular member sees only their own
        personWhere = { userId: sessionUserId, teamId: userTeamId }
      }
    } else {
      // Personal (non-team) users
      personWhere = { userId: sessionUserId, teamId: null }
    }

    const allPersons = await prisma.person.findMany({
      where: personWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true
      },
      orderBy: { firstName: 'asc' }
    })

    // Transform to response format - include all persons, even with 0 count
    const personCounts = allPersons.map(person => ({
      personId: person.id,
      personName: person.firstName || 'Unknown',
      personUserId: person.userId,
      count: countMap.get(person.id) || 0
    }))

    // Get total count
    const totalCount = counts.reduce((sum, c) => sum + c._count.id, 0)

    return NextResponse.json({
      personCounts,
      totalCount
    })

  } catch (error) {
    Logger.error('Failed to get generation counts', { error: error instanceof Error ? error.message : String(error) })
    return internalError('Failed to get generation counts')
  }
}

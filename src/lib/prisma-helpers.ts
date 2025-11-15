import type { Prisma } from '@prisma/client'

/**
 * Prisma query helper utilities
 * Provides consistent WHERE clause builders for common query patterns
 */

/**
 * Build WHERE clause for generation queries (personal + team)
 * @param userId - The user ID
 * @param teamId - Optional team ID (null for personal-only)
 * @returns Prisma WHERE clause for generation queries
 */
export function buildGenerationWhere(
  userId: string,
  teamId: string | null
): Prisma.GenerationWhereInput {
  if (teamId) {
    return {
      OR: [
        // Personal generations
        {
          person: {
            userId,
          },
        },
        // Team generations
        {
          person: {
            teamId,
          },
        },
      ],
    }
  }

  // When no team, use simple condition (no OR needed)
  return {
    person: {
      userId,
    },
  }
}

/**
 * Build WHERE clause for context queries (personal + team)
 * @param userId - The user ID
 * @param teamId - Optional team ID (null for personal-only)
 * @returns Prisma WHERE clause for context queries
 */
export function buildContextWhere(
  userId: string,
  teamId: string | null
): Prisma.ContextWhereInput {
  if (teamId) {
    return {
      OR: [
        // Personal contexts
        { userId },
        // Team contexts
        { teamId },
      ],
    }
  }

  // When no team, use simple condition (no OR needed)
  return {
    userId,
  }
}

/**
 * Build WHERE clause for person queries (personal + team)
 * @param userId - The user ID
 * @param teamId - Optional team ID (null for personal-only)
 * @returns Prisma WHERE clause for person queries
 */
export function buildPersonWhere(
  userId: string,
  teamId: string | null
): Prisma.PersonWhereInput {
  if (teamId) {
    return {
      OR: [
        // Personal person
        { userId },
        // Team members
        { teamId },
      ],
    }
  }

  return {
    userId,
  }
}


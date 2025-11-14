/**
 * Generation utility functions
 * Centralized logic for deriving generation properties from person data
 */

/**
 * Derive generation type from person's team membership
 * If person.teamId exists, it's a team generation; otherwise, it's personal
 */
export function deriveGenerationType(personTeamId: string | null | undefined): 'personal' | 'team' {
  return personTeamId ? 'team' : 'personal'
}

/**
 * Derive credit source from person's team membership
 * Team members always use team credits; individual users use personal credits
 */
export function deriveCreditSource(personTeamId: string | null | undefined): 'individual' | 'team' {
  return personTeamId ? 'team' : 'individual'
}


import { prisma } from '@/lib/prisma'

export type TeamOnboardingStep = 'team_setup' | 'style_setup' | 'invite_members'

export interface TeamOnboardingState {
  needsTeamSetup: boolean
  needsPhotoStyleSetup: boolean
  needsTeamInvites: boolean
  nextStep: TeamOnboardingStep | null
  activeContextId: string | null
  pendingInviteCount: number
  totalMemberCount: number
}

interface TeamOnboardingInput {
  isTeamAdmin: boolean
  teamId?: string | null
  teamName?: string | null
  prefetchedMemberCount?: number
  prefetchedPendingInviteCount?: number
}

const DEFAULT_STATE: TeamOnboardingState = {
  needsTeamSetup: false,
  needsPhotoStyleSetup: false,
  needsTeamInvites: false,
  nextStep: null,
  activeContextId: null,
  pendingInviteCount: 0,
  totalMemberCount: 0
}

/**
 * Determine the onboarding state for a team admin.
 * Returns which step should be highlighted in the UI (team setup, style setup, invites)
 * along with supporting metadata.
 */
export async function getTeamOnboardingState({
  isTeamAdmin,
  teamId,
  teamName,
  prefetchedMemberCount,
  prefetchedPendingInviteCount
}: TeamOnboardingInput): Promise<TeamOnboardingState> {
  if (!isTeamAdmin) {
    return DEFAULT_STATE
  }

  if (!teamId) {
    return {
      ...DEFAULT_STATE,
      needsTeamSetup: true,
      nextStep: 'team_setup'
    }
  }

  // Check if team name is null or empty string - treat as needing setup
  // Team exists but hasn't been named yet
  if (!teamName || teamName.trim() === '') {
    return {
      ...DEFAULT_STATE,
      needsTeamSetup: true,
      nextStep: 'team_setup'
    }
  }

  const [
    teamRecord,
    pendingInviteCount,
    memberCount
  ] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: { activeContextId: true }
    }),
    prefetchedPendingInviteCount !== undefined
      ? Promise.resolve(prefetchedPendingInviteCount)
      : prisma.teamInvite.count({
          where: {
            teamId,
            usedAt: null,
            expiresAt: {
              gt: new Date()
            }
          }
        }),
    prefetchedMemberCount !== undefined
      ? Promise.resolve(prefetchedMemberCount)
      : prisma.person.count({
          where: { teamId }
        })
  ])

  // If the team record was not found (should not happen), fall back to prompting setup again
  if (!teamRecord) {
    return {
      ...DEFAULT_STATE,
      needsTeamSetup: true,
      nextStep: 'team_setup'
    }
  }

  const hasActiveContext = Boolean(teamRecord.activeContextId)
  const needsPhotoStyleSetup = !hasActiveContext
  const nonAdminMembers = Math.max(memberCount - 1, 0)
  const needsTeamInvites = !needsPhotoStyleSetup && nonAdminMembers === 0 && pendingInviteCount === 0

  let nextStep: TeamOnboardingStep | null = null
  if (needsPhotoStyleSetup) {
    nextStep = 'style_setup'
  } else if (needsTeamInvites) {
    nextStep = 'invite_members'
  }

  return {
    needsTeamSetup: false,
    needsPhotoStyleSetup,
    needsTeamInvites,
    nextStep,
    activeContextId: teamRecord.activeContextId ?? null,
    pendingInviteCount,
    totalMemberCount: memberCount
  }
}


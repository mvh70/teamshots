import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createBulkInvites, ParsedRow } from '@/domain/team/bulk-invite'
import { sendTeamInviteEmail } from '@/lib/email'
import { Logger } from '@/lib/logger'
import { isSeatsBasedTeam, canAddTeamMember } from '@/domain/pricing/seats'
import { getPackageConfig } from '@/domain/style/packages'
import { Prisma } from '@prisma/client'

/**
 * Generate a new Zapier API key
 * @returns Object with plain key (to show once) and hashed key (to store)
 */
export function generateZapierApiKey(): { plainKey: string; hashedKey: string } {
  const randomPart = randomBytes(32).toString('base64url')
  const plainKey = `zap_${randomPart}`
  const hashedKey = createHash('sha256').update(plainKey).digest('hex')
  return { plainKey, hashedKey }
}

/**
 * Hash a plain API key for lookup
 */
export function hashApiKey(plainKey: string): string {
  return createHash('sha256').update(plainKey).digest('hex')
}

/**
 * Validate a Zapier API key and return the associated team
 */
export async function validateZapierApiKey(
  plainKey: string,
  ipAddress?: string
): Promise<{
  valid: boolean
  team?: {
    id: string
    name: string | null
    adminId: string
    admin: {
      id: string
      email: string
      locale: string
      planPeriod: string | null
      person: { firstName: string } | null
    }
    activeContext: { id: string } | null
  }
  error?: string
}> {
  if (!plainKey || !plainKey.startsWith('zap_')) {
    return { valid: false, error: 'Invalid API key format' }
  }

  const hashedKey = hashApiKey(plainKey)

  const apiKey = await prisma.zapierApiKey.findUnique({
    where: { token: hashedKey },
    include: {
      team: {
        include: {
          admin: {
            select: {
              id: true,
              email: true,
              locale: true,
              planPeriod: true,
              person: {
                select: { firstName: true }
              }
            }
          },
          activeContext: {
            select: { id: true }
          }
        }
      }
    }
  })

  if (!apiKey) {
    return { valid: false, error: 'Invalid API key' }
  }

  if (apiKey.revokedAt) {
    return { valid: false, error: 'API key has been revoked' }
  }

  // Update last used timestamp
  await prisma.zapierApiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: new Date(),
      lastUsedIp: ipAddress || null
    }
  })

  return {
    valid: true,
    team: apiKey.team
  }
}

/**
 * Create a team invite via Zapier
 */
export async function createZapierInvite(params: {
  teamId: string
  email: string
  firstName: string
  lastName?: string
  baseUrl: string
  ipAddress?: string
}): Promise<{
  success: boolean
  invite?: {
    id: string
    email: string
    firstName: string
    inviteLink: string
    status: 'pending'
  }
  error?: string
  errorCode?: string
}> {
  const { teamId, email, firstName, baseUrl, ipAddress } = params
  const normalizedEmail = email.toLowerCase().trim()

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(normalizedEmail)) {
    return { success: false, error: 'Invalid email format', errorCode: 'INVALID_EMAIL' }
  }

  // Get team with admin info
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          locale: true,
          planPeriod: true,
          person: { select: { firstName: true } }
        }
      },
      activeContext: true
    }
  })

  if (!team) {
    return { success: false, error: 'Team not found', errorCode: 'TEAM_NOT_FOUND' }
  }

  // Check if email already has a pending invite
  const existingInvite = await prisma.teamInvite.findFirst({
    where: {
      teamId,
      email: normalizedEmail,
      usedAt: null,
      expiresAt: { gt: new Date() }
    }
  })

  if (existingInvite) {
    return {
      success: false,
      error: 'An active invite already exists for this email',
      errorCode: 'INVITE_EXISTS'
    }
  }

  // Check if person is already a team member
  const existingMember = await prisma.person.findFirst({
    where: {
      teamId,
      email: normalizedEmail
    }
  })

  if (existingMember) {
    return {
      success: false,
      error: 'This email is already a team member',
      errorCode: 'ALREADY_MEMBER'
    }
  }

  // Check seats availability for seats-based teams
  const useSeatsModel = await isSeatsBasedTeam(teamId)
  if (useSeatsModel) {
    const seatCheck = await canAddTeamMember(teamId)
    if (!seatCheck.canAdd) {
      return {
        success: false,
        error: `No available seats. Current: ${seatCheck.currentSeats}/${seatCheck.totalSeats}`,
        errorCode: 'NO_AVAILABLE_SEATS'
      }
    }
  }

  // Determine context to use
  const rawAdminPlanPeriod = team.admin.planPeriod
  const adminPlanPeriod = rawAdminPlanPeriod === 'month' ? 'monthly' : rawAdminPlanPeriod === 'year' ? 'annual' : rawAdminPlanPeriod
  const isAdminOnFreePlan = adminPlanPeriod === 'free' || !adminPlanPeriod

  let contextToUse: typeof team.activeContext = null

  if (isAdminOnFreePlan) {
    // Get or create free package context
    const setting = await prisma.appSetting.findUnique({ where: { key: 'freePackageStyleId' } })

    if (setting?.value) {
      contextToUse = await prisma.context.findUnique({
        where: { id: setting.value }
      })
    }

    if (!contextToUse) {
      try {
        const pkg = getPackageConfig('freepackage')
        const defaultSettings = pkg.defaultSettings
        const serializedSettings = pkg.persistenceAdapter.serialize(defaultSettings) as Record<string, unknown>
        serializedSettings.stylePreset = pkg.defaultPresetId

        const newContext = await prisma.context.create({
          data: {
            name: 'Free Package Style',
            settings: serializedSettings as Prisma.InputJsonValue
          },
          select: { id: true }
        })

        await prisma.appSetting.upsert({
          where: { key: 'freePackageStyleId' },
          update: { value: newContext.id },
          create: { key: 'freePackageStyleId', value: newContext.id }
        })

        contextToUse = await prisma.context.findUnique({
          where: { id: newContext.id }
        })

        Logger.info('Auto-created free package context for Zapier invitation', {
          contextId: newContext.id,
          teamId
        })
      } catch (error) {
        Logger.error('Failed to auto-create free package context for Zapier', {
          error: error instanceof Error ? error.message : String(error),
          teamId
        })
      }
    }
  } else {
    contextToUse = team.activeContext
  }

  if (!contextToUse) {
    return {
      success: false,
      error: 'Team has no active style configured. Please set up a style first.',
      errorCode: 'NO_ACTIVE_CONTEXT'
    }
  }

  // Create the invite using existing bulk-invite logic
  const parsedRow: ParsedRow = {
    email: normalizedEmail,
    firstName: firstName.trim(),
    lastName: params.lastName?.trim(),
    rowNumber: 1
  }

  const result = await createBulkInvites(
    teamId,
    contextToUse.id,
    [parsedRow],
    baseUrl
  )

  if (!result.success || result.invites.length === 0) {
    return {
      success: false,
      error: result.error || 'Failed to create invite',
      errorCode: 'CREATE_FAILED'
    }
  }

  const invite = result.invites[0]

  // Send invite email
  try {
    const inviterFirstName = team.admin.person?.firstName || team.admin.email.split('@')[0] || 'Team Admin'
    const locale = (team.admin.locale || 'en') as 'en' | 'es'

    await sendTeamInviteEmail({
      email: invite.email,
      teamName: team.name || 'Team',
      inviteLink: invite.inviteLink,
      creditsAllocated: 10,
      firstName: invite.firstName,
      inviterFirstName,
      locale
    })

    Logger.info('Zapier invite created and email sent', {
      teamId,
      inviteId: invite.id,
      email: invite.email,
      ipAddress
    })
  } catch (error) {
    Logger.error('Failed to send Zapier invite email', {
      teamId,
      inviteId: invite.id,
      email: invite.email,
      error: error instanceof Error ? error.message : String(error)
    })
    // Don't fail the whole operation if email fails - invite is still created
  }

  return {
    success: true,
    invite: {
      id: invite.id,
      email: invite.email,
      firstName: invite.firstName,
      inviteLink: invite.inviteLink,
      status: 'pending'
    }
  }
}

/**
 * Create a new API key for a team
 */
export async function createApiKeyForTeam(
  teamId: string,
  name: string = 'Default'
): Promise<{ id: string; plainKey: string; name: string; createdAt: Date }> {
  const { plainKey, hashedKey } = generateZapierApiKey()

  const apiKey = await prisma.zapierApiKey.create({
    data: {
      teamId,
      token: hashedKey,
      name
    }
  })

  return {
    id: apiKey.id,
    plainKey, // Only returned on creation!
    name: apiKey.name,
    createdAt: apiKey.createdAt
  }
}

/**
 * List all API keys for a team (returns masked info only)
 */
export async function listApiKeysForTeam(teamId: string): Promise<
  Array<{
    id: string
    name: string
    createdAt: Date
    lastUsedAt: Date | null
    isRevoked: boolean
    maskedPrefix: string
  }>
> {
  const keys = await prisma.zapierApiKey.findMany({
    where: { teamId },
    orderBy: { createdAt: 'desc' }
  })

  return keys.map((key) => ({
    id: key.id,
    name: key.name,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    isRevoked: key.revokedAt !== null,
    maskedPrefix: 'zap_****' // Never expose the actual key
  }))
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string, teamId: string): Promise<boolean> {
  const key = await prisma.zapierApiKey.findFirst({
    where: { id: keyId, teamId }
  })

  if (!key) {
    return false
  }

  await prisma.zapierApiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() }
  })

  Logger.info('Zapier API key revoked', { keyId, teamId })
  return true
}

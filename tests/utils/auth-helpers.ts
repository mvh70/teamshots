import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Page } from '@playwright/test'
import { PRICING_CONFIG } from '@/config/pricing'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/teamshots_test?schema=public'
    }
  }
})

export interface TestUser {
  id: string
  email: string
  password: string
  personId?: string
  teamId?: string
}

export interface TestTeam {
  id: string
  name: string
  adminId: string
  activeContextId?: string
}

export interface TestInvite {
  id: string
  token: string
  email: string
  teamId: string
  creditsAllocated: number
}

/**
 * Create a test user with optional team membership
 */
export async function createTestUser(options: {
  email?: string
  password?: string
  firstName?: string
  lastName?: string
  role?: 'user' | 'team_admin' | 'team_member'
  planTier?: 'individual' | 'pro'
  planPeriod?: 'free' | 'monthly' | 'annual'
  teamId?: string
  locale?: string
}): Promise<TestUser> {
  const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const email = options.email || `test-${testId}@example.com`
  const password = options.password || 'TestPassword123!'
  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: options.role || 'user',
      planTier: options.planTier,
      planPeriod: options.planPeriod || 'free',
      locale: options.locale || 'en',
      emailVerified: new Date(),
    }
  })

  const person = await prisma.person.create({
    data: {
      firstName: options.firstName || 'Test',
      lastName: options.lastName || 'User',
      email,
      userId: user.id,
      teamId: options.teamId,
    }
  })

  return {
    id: user.id,
    email: user.email,
    password,
    personId: person.id,
    teamId: person.teamId || undefined,
  }
}

/**
 * Create a team admin (pro user) with team
 */
export async function createTeamAdmin(options: {
  email?: string
  password?: string
  firstName?: string
  teamName?: string
  teamWebsite?: string
  credits?: number
}): Promise<{ user: TestUser; team: TestTeam }> {
  const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const email = options.email || `admin-${testId}@testteam.com`
  const password = options.password || 'TestPassword123!'
  const hashedPassword = await bcrypt.hash(password, 10)

  // Create user with pro tier
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'team_admin',
      planTier: 'pro',
      planPeriod: 'free', // Free plan initially, can be upgraded
      locale: 'en',
      emailVerified: new Date(),
    }
  })

  // Create person
  const person = await prisma.person.create({
    data: {
      firstName: options.firstName || 'Admin',
      lastName: 'User',
      email,
      userId: user.id,
    }
  })

  // Create team
  const team = await prisma.team.create({
    data: {
      name: options.teamName || `Test Team ${testId}`,
      website: options.teamWebsite,
      adminId: user.id,
      teamMembers: {
        connect: { id: person.id }
      }
    }
  })

  // Update person with teamId
  await prisma.person.update({
    where: { id: person.id },
    data: { teamId: team.id }
  })

  // Add credits to team if specified
  if (options.credits && options.credits > 0) {
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        teamId: team.id,
        credits: options.credits,
        type: 'free_grant',
        description: 'Test team credits',
        planTier: 'pro',
        planPeriod: 'free',
      }
    })
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      password,
      personId: person.id,
      teamId: team.id,
    },
    team: {
      id: team.id,
      name: team.name,
      adminId: user.id,
    }
  }
}

/**
 * Create an individual user (non-team)
 */
export async function createIndividualUser(options: {
  email?: string
  password?: string
  firstName?: string
  credits?: number
}): Promise<TestUser> {
  const user = await createTestUser({
    email: options.email,
    password: options.password,
    firstName: options.firstName,
    role: 'user',
    planTier: 'individual',
    planPeriod: 'free',
  })

  // Add credits if specified
  if (options.credits && options.credits > 0) {
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        credits: options.credits,
        type: 'free_grant',
        description: 'Test individual credits',
        planTier: 'individual',
        planPeriod: 'free',
      }
    })
  }

  return user
}

/**
 * Create a team invite
 */
export async function createInvite(options: {
  teamId: string
  email: string
  firstName: string
  creditsAllocated?: number
  contextId?: string
  expiresInHours?: number
}): Promise<TestInvite> {
  const { randomBytes } = await import('crypto')
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + (options.expiresInHours || 24) * 60 * 60 * 1000)

  const invite = await prisma.teamInvite.create({
    data: {
      email: options.email,
      firstName: options.firstName,
      teamId: options.teamId,
      token,
      expiresAt,
      creditsAllocated: options.creditsAllocated || PRICING_CONFIG.team.defaultInviteCredits,
      contextId: options.contextId,
    }
  })

  return {
    id: invite.id,
    token: invite.token,
    email: invite.email,
    teamId: invite.teamId,
    creditsAllocated: invite.creditsAllocated,
  }
}

/**
 * Accept an invite and create Person record
 */
export async function acceptInvite(options: {
  token: string
  firstName: string
  lastName?: string
}): Promise<{ personId: string; teamId: string }> {
  const invite = await prisma.teamInvite.findUnique({
    where: { token: options.token },
    include: { team: true }
  })

  if (!invite) {
    throw new Error(`Invite not found for token: ${options.token}`)
  }

  if (invite.expiresAt < new Date()) {
    throw new Error('Invite has expired')
  }

  if (invite.usedAt) {
    throw new Error('Invite has already been used')
  }

  // Create person record
  const person = await prisma.person.create({
    data: {
      firstName: options.firstName,
      lastName: options.lastName || null,
      email: invite.email,
      teamId: invite.teamId,
      inviteToken: options.token,
    }
  })

  // Allocate credits from invite
  const { allocateCreditsFromInvite } = await import('@/domain/credits/credits')
  await allocateCreditsFromInvite(
    person.id,
    invite.id,
    invite.creditsAllocated,
    `Credits allocated from team invite to ${invite.email}`
  )

  // Mark invite as used
  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: {
      usedAt: new Date(),
      personId: person.id,
    }
  })

  return {
    personId: person.id,
    teamId: invite.teamId,
  }
}

/**
 * Login as a user via Playwright page
 */
export async function loginAs(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto('https://localhost:3000/en/auth/signin')
  await page.waitForLoadState('networkidle')
  
  await page.fill('input[id="email"]', user.email)
  await page.fill('input[id="password"]', user.password)
  await page.click('button[type="submit"]')
  
  // Wait for redirect to dashboard
  await page.waitForURL('**/app/dashboard', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

/**
 * Create a team context
 */
export async function createTeamContext(options: {
  teamId: string
  name?: string
  stylePreset?: string
  settings?: Record<string, unknown>
}): Promise<{ id: string }> {
  const context = await prisma.context.create({
    data: {
      name: options.name || 'Test Context',
      teamId: options.teamId,
      stylePreset: options.stylePreset || 'corporate',
      settings: options.settings || {},
    }
  })

  // Set as active context for team
  await prisma.team.update({
    where: { id: options.teamId },
    data: { activeContextId: context.id }
  })

  return { id: context.id }
}

/**
 * Get Prisma client instance
 */
export function getPrisma(): PrismaClient {
  return prisma
}


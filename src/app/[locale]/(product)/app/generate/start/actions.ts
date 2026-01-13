'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'
import { getPackageConfig } from '@/domain/style/packages'
import { PhotoStyleSettings, DEFAULT_PHOTO_STYLE_SETTINGS } from '@/types/photo-style'
import { getUserSubscription } from '@/domain/subscription/subscription'
import { PACKAGES_CONFIG } from '@/config/packages'
import { extractPackageId } from '@/domain/style/settings-resolver'

export type ContextOption = {
  id: string
  name: string
  customPrompt?: string | null
  settings?: Record<string, unknown>
  backgroundPrompt?: string
  stylePreset?: string
}

export type OwnedPackage = {
  packageId: string
  name: string
  label: string
}

export type GenerationPageData = {
  session: {
    userId: string
    role: string
    isAdmin: boolean
    personId?: string | null
    teamId?: string | null
  } | null
  selectedSelfies: Array<{ id: string; key: string }>
  selfieFromQuery: { id: string } | null
  styleData: {
    photoStyleSettings: PhotoStyleSettings
    originalContextSettings: PhotoStyleSettings | undefined
    selectedPackageId: string
    activeContext: ContextOption | null
    availableContexts: ContextOption[]
  }
  planInfo: {
    tier: string | null
    isFreePlan: boolean
    isProUser: boolean
    isTeamAdmin: boolean
    isTeamMember: boolean
  }
  ownedPackages: OwnedPackage[]
}

/**
 * Server action to fetch all data needed for generation page
 * Replaces multiple useEffect hooks with single server-side data fetch
 */
export async function getGenerationPageData(keyFromQuery?: string): Promise<GenerationPageData> {
  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      session: null,
      selectedSelfies: [],
      selfieFromQuery: null,
      styleData: {
        photoStyleSettings: DEFAULT_PHOTO_STYLE_SETTINGS,
        originalContextSettings: undefined,
        selectedPackageId: PACKAGES_CONFIG.defaultPlanPackage,
        activeContext: null,
        availableContexts: []
      },
      planInfo: {
        tier: null,
        isFreePlan: true,
        isProUser: false,
        isTeamAdmin: false,
        isTeamMember: false
      },
      ownedPackages: []
    }
  }

  type PrismaWithUserPackage = typeof prisma & { 
    userPackage: { 
      findMany: (...args: unknown[]) => Promise<Array<{ packageId: string; purchasedAt: Date | null; createdAt: Date }>> 
    } 
  }
  const prismaEx = prisma as unknown as PrismaWithUserPackage

  // Fetch all data in parallel
  const [
    person,
    selectedSelfies,
    selfieFromQuery,
    subscription,
    userPackages
  ] = await Promise.all([
    prisma.person.findUnique({
      where: { userId: session.user.id },
      select: { 
        id: true, 
        teamId: true,
        team: {
          select: {
            id: true,
            adminId: true
          }
        }
      }
    }),
    // Fetch selected selfies
    prisma.selfie.findMany({
      where: { 
        person: { userId: session.user.id },
        selected: true 
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, key: true }
    }),
    // Fetch selfie from query if provided
    keyFromQuery ? prisma.selfie.findFirst({
      where: { 
        key: keyFromQuery,
        person: { userId: session.user.id }
      },
      select: { id: true }
    }) : Promise.resolve(null),
    // Fetch subscription
    getUserSubscription(session.user.id),
    // Fetch owned packages
    prismaEx.userPackage.findMany({
      where: { userId: session.user.id },
      select: {
        packageId: true
      },
      orderBy: { createdAt: 'asc' }
    })
  ])

  // Process owned packages
  const ownedPackages = userPackages.map((up: { packageId: string }) => {
    const packageConfig = getPackageConfig(up.packageId)
    const packageMetadata = PACKAGES_CONFIG.active[up.packageId as keyof typeof PACKAGES_CONFIG.active]
    
    return {
      packageId: up.packageId,
      name: packageMetadata?.name || packageConfig.label,
      label: packageConfig.label
    }
  })

  // Determine plan info
  const tier = subscription?.tier ?? null
  const period = subscription?.period ?? null
  
  // User is on free plan if:
  // 1. No tier (null/undefined)
  // 2. OR period === 'free' (pro users on free trial period)
  const isFreePlan = !tier || period === 'free'
  const isProUser = tier === 'pro' && period !== 'free' // Pro user NOT on free trial
  const isTeamAdmin = session.user.role === 'team_admin'
  const isTeamMember = session.user.role === 'team_member'

  // Fetch style data based on plan
  // Team admins and team members should use team generation type, regardless of tier
  const shouldUseTeamGeneration = isTeamAdmin || isTeamMember || (isProUser && person?.teamId)
  const styleData = await fetchStyleData({
    userId: session.user.id,
    isFreePlan,
    isProUser,
    generationType: shouldUseTeamGeneration ? 'team' : 'personal',
    teamId: person?.teamId ?? null
  })

  return {
    session: {
      userId: session.user.id,
      role: session.user.role,
      isAdmin: session.user.isAdmin,
      personId: person?.id ?? null,
      teamId: person?.teamId ?? null
    },
    selectedSelfies: selectedSelfies || [],
    selfieFromQuery: selfieFromQuery || null,
    styleData,
    planInfo: {
      tier,
      isFreePlan,
      isProUser,
      isTeamAdmin,
      isTeamMember
    },
    ownedPackages
  }
}

async function fetchStyleData(params: {
  userId: string
  isFreePlan: boolean
  isProUser: boolean
  generationType: 'personal' | 'team'
  teamId: string | null
}): Promise<GenerationPageData['styleData']> {
  // RUNTIME ACCESS CONTROL: Free plan users are restricted to freepackage style
  // Note: Users may "own" headshot1 in UserPackage table (granted on signup), but
  // we enforce freepackage during their free trial period as a teaser/demo.
  // When they upgrade to paid, this override is lifted and they get their owned packages.
  // This prevents free users from bypassing restrictions via custom contexts.
  if (params.isFreePlan) {
    // Query database directly instead of using fetch (Server Actions requirement)
    const setting = await prisma.appSetting.findUnique({ 
      where: { key: 'freePackageStyleId' } 
    })
    
    const freepackagePkg = getPackageConfig('freepackage')
    
    if (!setting?.value) {
      // No admin-configured style, use freepackage defaults
      return {
        photoStyleSettings: freepackagePkg.defaultSettings,
        originalContextSettings: freepackagePkg.defaultSettings,
        selectedPackageId: 'freepackage',
        activeContext: null,
        availableContexts: []
      }
    }
    
    // Load the admin-configured context
    const ctx = await prisma.context.findUnique({
      where: { id: setting.value },
      select: { id: true, name: true, settings: true, packageName: true }
    })

    if (!ctx) {
      // Context not found, use freepackage defaults
      return {
        photoStyleSettings: freepackagePkg.defaultSettings,
        originalContextSettings: freepackagePkg.defaultSettings,
        selectedPackageId: 'freepackage',
        activeContext: null,
        availableContexts: []
      }
    }

    // Deserialize the admin-configured settings
    const ui = freepackagePkg.persistenceAdapter.deserialize(
      (ctx.settings as Record<string, unknown>) || {}
    )

    // Get customPrompt from settings
    const customPrompt = (ctx.settings as Record<string, unknown>)?.customPrompt as string | null

    return {
      photoStyleSettings: ui,
      originalContextSettings: ui,
      selectedPackageId: 'freepackage',
      activeContext: {
        id: ctx.id,
        name: ctx.name || 'Free Package Style',
        settings: ui as Record<string, unknown>,
        customPrompt
      },
      availableContexts: []
    }
  }

  // Paid users: fetch contexts based on generation type
  if (params.generationType === 'team' && params.teamId) {
    // Fetch team contexts
    const team = await prisma.team.findUnique({
      where: { id: params.teamId },
      include: {
        contexts: {
          where: { 
            teamId: { not: null },
            userId: null
          },
          orderBy: { createdAt: 'desc' }
        },
        activeContext: true
      }
    })

    const rawContexts = team?.contexts || []
    const contexts: ContextOption[] = rawContexts.map((ctx: { id: string; name: string | null; settings: unknown }, index: number) => ({
      id: ctx.id,
      name: ctx.name || `Team Style ${rawContexts.length - index}`,
      customPrompt: (ctx.settings as Record<string, unknown>)?.customPrompt as string | null,
      settings: ctx.settings as Record<string, unknown>
    }))

    let activeContextData = team?.activeContext

    // Fallback: if activeContextId exists but relation didn't load, fetch directly
    if (team && team.activeContextId && !activeContextData) {
      try {
        const fallbackContext = await prisma.context.findUnique({
          where: { id: team.activeContextId },
          select: { id: true, name: true, settings: true, packageName: true }
        })
        if (fallbackContext) {
          // Cast to match the expected type (we only need the selected fields)
          activeContextData = fallbackContext as typeof team.activeContext
        }
      } catch (error) {
        Logger.error('[fetchStyleData] Error fetching fallback context', { error })
      }
    }
    
    if (activeContextData) {
      try {
        // Deserialize the context settings directly
        // Try to extract packageId from settings first, then fall back to packageName field on context
        const extractedPackageId = extractPackageId(activeContextData.settings as Record<string, unknown>)
        const contextPackageName = (activeContextData as { packageName?: string }).packageName
        const packageId = extractedPackageId || contextPackageName || 'headshot1'
        
        const pkg = getPackageConfig(packageId)
        const ui = pkg.persistenceAdapter.deserialize(
          (activeContextData.settings as Record<string, unknown>) || {}
        )
        
        return {
          photoStyleSettings: ui,
          originalContextSettings: ui,
          selectedPackageId: pkg.id,
          activeContext: {
            id: activeContextData.id,
            name: activeContextData.name || 'Team Style',
            customPrompt: (activeContextData.settings as Record<string, unknown>)?.customPrompt as string | null,
            settings: ui as Record<string, unknown>,
            backgroundPrompt: (activeContextData.settings as Record<string, unknown> | undefined)?.['backgroundPrompt'] as string | undefined,
            stylePreset: undefined // Will be derived from package
          },
          availableContexts: contexts
        }
      } catch (error) {
        console.error('[Server Action] Error deserializing active context:', error)
        // Fall through to default settings
      }
    }

    return {
      photoStyleSettings: DEFAULT_PHOTO_STYLE_SETTINGS,
      originalContextSettings: undefined,
      selectedPackageId: PACKAGES_CONFIG.defaultPlanPackage,
      activeContext: null,
      availableContexts: contexts
    }
  }

  // Personal contexts - ONLY for paid users
  // Double-check: ensure we never load personal contexts for free plan users
  // (This is a safeguard in case isFreePlan was miscalculated)
  const subscriptionCheck = await getUserSubscription(params.userId)
  const isActuallyFreePlan = !subscriptionCheck?.tier || subscriptionCheck?.period === 'free'
  
  if (isActuallyFreePlan) {
    // User is actually on free plan - return freepackage style instead
    const setting = await prisma.appSetting.findUnique({ 
      where: { key: 'freePackageStyleId' } 
    })
    const freepackagePkg = getPackageConfig('freepackage')
    
    if (setting?.value) {
      const ctx = await prisma.context.findUnique({
        where: { id: setting.value },
        select: { id: true, name: true, settings: true, packageName: true }
      })
      
      if (ctx) {
        const ui = freepackagePkg.persistenceAdapter.deserialize(
          (ctx.settings as Record<string, unknown>) || {}
        )
        return {
          photoStyleSettings: ui,
          originalContextSettings: ui,
          selectedPackageId: 'freepackage',
          activeContext: {
            id: ctx.id,
            name: ctx.name || 'Free Package Style',
            settings: ui as Record<string, unknown>,
            customPrompt: (ctx.settings as Record<string, unknown>)?.customPrompt as string | null
          },
          availableContexts: []
        }
      }
    }
    
    return {
      photoStyleSettings: freepackagePkg.defaultSettings,
      originalContextSettings: freepackagePkg.defaultSettings,
      selectedPackageId: 'freepackage',
      activeContext: null,
      availableContexts: []
    }
  }
  
  const [user, rawContexts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { metadata: true }
    }),
    prisma.context.findMany({
      where: {
        userId: params.userId,
        teamId: null
      },
      orderBy: { createdAt: 'desc' }
    })
  ])

  const userWithContexts = user ? { ...user, contexts: rawContexts } : null
  const contexts: ContextOption[] = rawContexts.map((ctx: { id: string; name: string | null; settings: unknown }, index: number) => ({
    id: ctx.id,
    name: ctx.name || `Personal Style ${rawContexts.length - index}`,
    customPrompt: (ctx.settings as Record<string, unknown>)?.customPrompt as string | null,
    settings: ctx.settings as Record<string, unknown>
  }))

  // Get active context from metadata
  let activeContextId: string | null = null
  if (userWithContexts?.metadata && typeof userWithContexts.metadata === 'object') {
    const metadata = userWithContexts.metadata as Record<string, unknown>
    activeContextId = (metadata.activeContextId as string) || null
  }

  if (activeContextId) {
    const activeCtx = rawContexts.find((c: { id: string; name: string | null; settings: unknown }) => c.id === activeContextId)
    
    if (activeCtx) {
      // Deserialize the context settings directly
      // Try to extract packageId from settings first, then fall back to packageName field on context
      const extractedPackageId = extractPackageId(activeCtx.settings as Record<string, unknown>)
      const contextPackageName = (activeCtx as { packageName?: string }).packageName
      const packageId = extractedPackageId || contextPackageName || 'headshot1'
      
      const pkg = getPackageConfig(packageId)
      const ui = pkg.persistenceAdapter.deserialize(
        (activeCtx.settings as Record<string, unknown>) || {}
      )
      
      return {
        photoStyleSettings: ui,
        originalContextSettings: ui,
        selectedPackageId: pkg.id,
        activeContext: {
          id: activeCtx.id,
          name: activeCtx.name || 'Personal Style',
          customPrompt: (activeCtx.settings as Record<string, unknown>)?.customPrompt as string | null,
          settings: ui as Record<string, unknown>,
          backgroundPrompt: (activeCtx.settings as Record<string, unknown> | undefined)?.['backgroundPrompt'] as string | undefined,
          stylePreset: undefined // Will be derived from package
        },
        availableContexts: contexts
      }
    }
  }

  return {
    photoStyleSettings: DEFAULT_PHOTO_STYLE_SETTINGS,
    originalContextSettings: undefined,
    selectedPackageId: PACKAGES_CONFIG.defaultPlanPackage,
    activeContext: null,
    availableContexts: contexts
  }
}


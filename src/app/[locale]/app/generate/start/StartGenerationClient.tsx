'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { useCredits } from '@/contexts/CreditsContext'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useBuyCreditsLink } from '@/hooks/useBuyCreditsLink'
import StyleSettingsSection from '@/components/customization/StyleSettingsSection'
import FreePlanBanner from '@/components/styles/FreePlanBanner'
import PackageSelector from '@/components/packages/PackageSelector'
import { PhotoStyleSettings as PhotoStyleSettingsType, DEFAULT_PHOTO_STYLE_SETTINGS } from '@/types/photo-style'
import { BRAND_CONFIG } from '@/config/brand'
import { PRICING_CONFIG } from '@/config/pricing'
import { PACKAGES_CONFIG } from '@/config/packages'
import { jsonFetcher } from '@/lib/fetcher'
import { loadStyleByContextId } from '@/domain/style/service'
import { getPackageConfig } from '@/domain/style/packages'
import GenerationSummaryTeam from '@/components/generation/GenerationSummaryTeam'
import GenerateButton from '@/components/generation/GenerateButton'
import { hasUneditedEditableFields } from '@/domain/style/userChoice'
import { useAnalytics } from '@/hooks/useAnalytics'
import { PurchaseSuccess } from '@/components/pricing/PurchaseSuccess'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import type { GenerationPageData, ContextOption } from './actions'

const GenerationTypeSelector = dynamic(() => import('@/components/GenerationTypeSelector'), { ssr: false })

interface StartGenerationClientProps {
  initialData: GenerationPageData
  keyFromQuery?: string
}

export default function StartGenerationClient({ initialData, keyFromQuery }: StartGenerationClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { track } = useAnalytics()
  const t = useTranslations('app.sidebar.generate')
  const skipUpload = useMemo(() => searchParams.get('skipUpload') === '1', [searchParams])
  
  // Check for success state after checkout
  const isSuccess = searchParams.get('success') === 'true'
  const successType = searchParams.get('type')
  
  // Initialize state from server data - no useEffect needed!
  const selectedSelfies = initialData.selectedSelfies
  const [generationType, setGenerationType] = useState<'personal' | 'team' | null>(null)
  const { credits: userCredits, loading: creditsLoading } = useCredits()
  const { href: buyCreditsHref } = useBuyCreditsLink()
  
  // Add returnTo parameter to buy credits link
  const buyCreditsHrefWithReturn = useMemo(() => {
    const returnTo = encodeURIComponent(pathname)
    const separator = buyCreditsHref.includes('?') ? '&' : '?'
    return `${buyCreditsHref}${separator}returnTo=${returnTo}`
  }, [buyCreditsHref, pathname])
  
  const personalFallbackLabel = t('fallbackPersonalStyle', { default: 'Personal Style' })
  const teamFallbackLabel = t('fallbackTeamStyle', { default: 'Team Style' })

  // Style state from server data
  const [activeContext, setActiveContext] = useState<ContextOption | null>(initialData.styleData.activeContext)
  const [availableContexts] = useState<ContextOption[]>(initialData.styleData.availableContexts)
  const [photoStyleSettings, setPhotoStyleSettings] = useState<PhotoStyleSettingsType>(initialData.styleData.photoStyleSettings)
  const [originalContextSettings] = useState<PhotoStyleSettingsType | undefined>(initialData.styleData.originalContextSettings)
  const [selectedPackageId, setSelectedPackageId] = useState<string>(initialData.styleData.selectedPackageId)
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Plan info from server data
  const { isFreePlan, isProUser, isTeamAdmin, isTeamMember } = initialData.planInfo
  const subscriptionTier = initialData.planInfo.tier

  const headerThumbs = useMemo(() => {
    const items = selectedSelfies.length > 0 ? selectedSelfies : (keyFromQuery ? [{ id: 'legacy', key: keyFromQuery }] : [])
    return items
  }, [selectedSelfies, keyFromQuery])

  // Derived state: session is available from server
  const session = useMemo(() => initialData.session ? {
    user: {
      id: initialData.session.userId,
      role: initialData.session.role,
      person: initialData.session.personId ? {
        id: initialData.session.personId,
        teamId: initialData.session.teamId
      } : undefined
    }
  } : null, [initialData.session])

  // ✅ KEEP: Redirect logic (legitimate side effect for navigation)
  const [isPending, startTransition] = useTransition()
  useEffect(() => {
    if (!skipUpload && selectedSelfies.length < 2 && !keyFromQuery && !isSuccess && session) {
      startTransition(() => {
        router.push('/app/generate/selfie')
      })
    }
  }, [skipUpload, selectedSelfies.length, keyFromQuery, router, isSuccess, session])

  const normalizeContextName = useCallback((rawName: string | null | undefined, index: number, total: number, type: 'personal' | 'team'): string => {
    const trimmed = (rawName ?? '').trim()
    if (trimmed && trimmed.toLowerCase() !== 'unnamed') {
      return trimmed
    }
    const base = type === 'team' ? teamFallbackLabel : personalFallbackLabel
    return total > 1 ? `${base} ${total - index}` : base
  }, [teamFallbackLabel, personalFallbackLabel])

  // Determine user access
  const hasTeamAccess = Boolean(session?.user?.person?.teamId)
  const hasTeamCredits = userCredits.team > 0
  const hasIndividualAccess = userCredits.individual > 0
  
  // Determine effective generation type
  const effectiveGenerationType: 'personal' | 'team' = useMemo(() => 
    generationType || 
    (isTeamAdmin || isTeamMember || isProUser
      ? 'team' 
      : (hasIndividualAccess ? 'personal' : (hasTeamAccess && hasTeamCredits ? 'team' : 'personal'))),
    [generationType, isTeamAdmin, isTeamMember, isProUser, hasIndividualAccess, hasTeamAccess, hasTeamCredits]
  )

  const onTypeSelected = (type: 'personal' | 'team') => {
    setGenerationType(type)
  }

  const onProceed = async () => {
    if (selectedSelfies.length < 2 || !effectiveGenerationType) {
      console.error('Missing required data for generation: need at least 2 selfies')
      return
    }

    if (isGenerating) return

    try {
      setIsGenerating(true)

      if (session?.user?.id) {
        track('generation_started', {
          user_id: session.user.id,
          generation_type: effectiveGenerationType,
          selfie_count: selectedSelfies.length,
          style_context_id: activeContext?.id,
          package_id: selectedPackageId || PACKAGES_CONFIG.defaultPlanPackage,
          is_free_plan: isFreePlan,
          subscription_tier: subscriptionTier
        })
      }

      const packageId = selectedPackageId || PACKAGES_CONFIG.defaultPlanPackage
      
      const payload: Record<string, unknown> = {
        contextId: activeContext?.id,
        styleSettings: { ...photoStyleSettings, packageId },
        prompt: activeContext?.customPrompt || 'Professional headshot',
        selfieIds: selectedSelfies.map(s => s.id),
        // Debug flags (workflow version is controlled by GENERATION_WORKFLOW_VERSION env var on server)
        debugMode: true, // Enable debug mode (logs prompts, saves intermediate files)
        // stopAfterStep removed - full flow will now execute
      }
      
      const response = await jsonFetcher<{ 
        success?: boolean
        error?: string
        accountMode?: {
          isPro: boolean
          redirectUrl: string
        }
      }>('/api/generations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const redirectUrl = response.accountMode?.redirectUrl || 
        (session?.user?.person?.teamId ? '/app/generations/team' : '/app/generations/personal')
      router.push(redirectUrl)
      
    } catch (error) {
      console.error('Failed to start generation:', error)
      alert(`Failed to start generation: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsGenerating(false)
    }
  }

  const teamName = session?.user?.person ? 'Team' : undefined
  
  const hasEnoughCredits = (effectiveGenerationType === 'team' && userCredits.team >= PRICING_CONFIG.credits.perGeneration) ||
                          (effectiveGenerationType === 'personal' && userCredits.individual >= PRICING_CONFIG.credits.perGeneration)
  const hasRequiredSelfies = selectedSelfies.length >= 2

  const effectivePackageId = isFreePlan ? 'freepackage' : (selectedPackageId || PACKAGES_CONFIG.defaultPlanPackage)

  const hasUneditedFields = originalContextSettings
    ? hasUneditedEditableFields(photoStyleSettings as Record<string, unknown>, originalContextSettings as Record<string, unknown>, effectivePackageId)
    : false

  const canGenerate = hasEnoughCredits && hasRequiredSelfies && effectiveGenerationType && !hasUneditedFields
  
  const hasAnyCredits = userCredits.team > 0 || userCredits.individual > 0
  const selectedPackage = getPackageConfig(effectivePackageId)
  const selectedPhotoStyleLabel = activeContext?.name || selectedPackage.label
  const remainingCreditsForType = effectiveGenerationType === 'team' ? userCredits.team : userCredits.individual
  const photoCreditsPerGeneration = calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration)
  
  const shouldShowGenerationTypeSelector = false

  if (isSuccess && (successType === 'try_once_success' || successType === 'individual_success' || successType === 'pro_small_success' || successType === 'pro_large_success')) {
    return <PurchaseSuccess />
  }

  if (!creditsLoading && !hasAnyCredits) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('noCreditsTitle')}</h1>
            <p className="text-gray-600 mb-6">{t('noCreditsMessage')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={buyCreditsHrefWithReturn}
                className="px-6 py-3 rounded-md text-white font-medium transition-colors"
                style={{ backgroundColor: BRAND_CONFIG.colors.cta }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.ctaHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.cta
                }}
              >
                {t('buyCredits')}
              </Link>
              <Link
                href="/app/dashboard"
                className="px-6 py-3 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                {t('backToDashboard')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!skipUpload && selectedSelfies.length < 2 && !keyFromQuery && session && !isSuccess) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Redirecting to selfie selection...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!skipUpload && (creditsLoading || !session) ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      ) : (!skipUpload && !activeContext && effectiveGenerationType === 'team' && isProUser && hasTeamAccess) ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Active Context</h2>
            <p className="text-gray-600 mb-4">Team users need to set up a photo style context before generating photos.</p>
            <Link 
              href="/app/contexts" 
              className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover"
            >
              Go to Contexts
            </Link>
          </div>
        </div>
      ) : skipUpload && shouldShowGenerationTypeSelector && !generationType ? (
        <GenerationTypeSelector
          uploadedPhotoKey={keyFromQuery || ''}
          onTypeSelected={onTypeSelected}
          userCredits={userCredits}
          hasTeamAccess={hasTeamAccess}
          teamName={teamName}
        />
      ) : skipUpload ? (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-4">{t('readyToGenerate')}</h1>
            
            {/* Alternative Layout: More balanced card-based approach */}
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
              {/* Left Section: Thumbnails and Summary */}
              <div className="flex gap-4 lg:flex-1 min-w-0">
                {/* Selected Selfie Thumbnails */}
                <div className="flex-none">
                  <div className={`grid ${headerThumbs.length <= 2 ? 'grid-flow-col auto-cols-max grid-rows-1' : 'grid-rows-2 grid-flow-col'} gap-2`}>
                    {headerThumbs.map((s) => (
                      <div key={s.id} className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden border border-gray-200 shadow-sm">
                        <Image
                          src={`/api/files/get?key=${encodeURIComponent(s.key)}`}
                          alt="Selected selfie"
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <GenerationSummaryTeam
                    type={effectiveGenerationType}
                    styleLabel={selectedPhotoStyleLabel}
                    remainingCredits={remainingCreditsForType}
                    perGenCredits={PRICING_CONFIG.credits.perGeneration}
                    showGenerateButton={false}
                    showCustomizeHint={false}
                    teamName={teamName || undefined}
                    showTitle={false}
                    plain
                    inlineHint
                  />
                </div>
              </div>

              {/* Right Section: Credits and Generate Action */}
              <div className="lg:flex-none lg:w-80 xl:w-96">
                <div className={`rounded-lg p-4 lg:p-5 border transition-all ${
                  !hasEnoughCredits 
                    ? 'bg-amber-50 border-amber-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="text-sm text-gray-600 mb-3">Cost per generation</div>
                  <div className="mb-4">
                    <div className="text-2xl lg:text-3xl font-bold text-gray-900">{photoCreditsPerGeneration}</div>
                    <div className="text-sm text-gray-600 mt-1">photo credits</div>
                  </div>
                  
                  {!hasEnoughCredits && (
                    <div className="mb-4 p-3 bg-white border border-amber-300 rounded-lg">
                      <div className="flex items-start gap-2.5">
                        <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-amber-900 mb-1">
                            {t('insufficientCredits')}
                          </p>
                          <p className="text-xs text-amber-800 leading-relaxed">
                            {t('insufficientCreditsMessage', {
                              required: calculatePhotosFromCredits(PRICING_CONFIG.credits.perGeneration),
                              current: calculatePhotosFromCredits(effectiveGenerationType === 'team' ? userCredits.team : userCredits.individual)
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    {!hasEnoughCredits ? (
                      <Link
                        href={buyCreditsHrefWithReturn}
                        className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-all shadow-sm hover:shadow"
                        style={{ backgroundColor: BRAND_CONFIG.colors.cta }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.ctaHover
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = BRAND_CONFIG.colors.cta
                        }}
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        {t('buyMoreCredits')}
                      </Link>
                    ) : (
                      <GenerateButton
                        onClick={onProceed}
                        disabled={!canGenerate || isPending}
                        isGenerating={isGenerating || isPending}
                        size="sm"
                        className="w-full"
                        disabledReason={hasUneditedFields ? t('customizeFirstTooltip') : undefined}
                        integrateInPopover={hasUneditedFields}
                      >
                        Generate
                      </GenerateButton>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Context Selection for Personal and Team Generations - Hide for free plan users */}
          {!isFreePlan && (generationType === 'personal' || generationType === 'team') && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {generationType === 'personal' ? t('selectPhotoStyle') : 'Select Team Photo Style'}
              </h2>
              
              <div className="space-y-3">
                <div>
                  <select
                    value={activeContext?.id || 'freestyle'}
                    onChange={async (e) => {
                      if (e.target.value === 'freestyle') {
                        setActiveContext(null)
                        setPhotoStyleSettings(DEFAULT_PHOTO_STYLE_SETTINGS)
                      } else {
                        const selectedContext = availableContexts.find(ctx => ctx.id === e.target.value)
                        if (selectedContext) {
                          const { ui, pkg, context } = await loadStyleByContextId(selectedContext.id)
                          const contextIndex = availableContexts.findIndex((ctx) => ctx.id === selectedContext.id)
                          const effectiveType = isProUser ? (generationType ?? 'personal') : 'personal'
                          const updatedName = normalizeContextName(
                            context?.name ?? selectedContext.name,
                            contextIndex === -1 ? availableContexts.length : contextIndex,
                            availableContexts.length || 1,
                            effectiveType
                          )
                          const enrichedContext = {
                            id: selectedContext.id,
                            name: updatedName,
                            customPrompt: (context?.settings as Record<string, unknown> | undefined)?.['customPrompt'] as string | null | undefined ?? null,
                            settings: context?.settings ?? selectedContext.settings,
                            backgroundPrompt: (context?.settings as Record<string, unknown> | undefined)?.['backgroundPrompt'] as string | undefined,
                            stylePreset: (context?.settings as Record<string, unknown> | undefined)?.['stylePreset'] as string | undefined
                          }
                          setActiveContext(enrichedContext)
                          setPhotoStyleSettings(ui)
                          setSelectedPackageId(pkg.id)
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                  >
                    <option value="freestyle">{t('freestyle')}</option>
                    {availableContexts.map((context) => (
                      <option key={context.id} value={context.id}>
                        {context.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-600 mt-2">
                    {activeContext ? 
                      (generationType === 'personal' ? t('predefinedStyle') : 'Predefined team style settings are applied. You can customize user-choice settings for this generation.') : 
                      (availableContexts.length > 0 ? 
                        (generationType === 'personal' ? t('freestyleDescription') : 'Create a custom team photo style for this generation.') : 
                        (generationType === 'personal' ? t('freestyleOnlyDescription') : 'No team styles available. Create a custom team photo style for this generation.'))
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Free plan banner + Free package info */}
          {(isFreePlan || selectedPackageId === 'freepackage') && (
            <>
              <FreePlanBanner variant="personal" className="mb-4" />
            </>
          )}

          {/* Package Selector - Hide for free package contexts */}
          {selectedPackageId !== 'freepackage' && (
            <PackageSelector
              value={selectedPackageId}
              onChange={(packageId) => {
                setSelectedPackageId(packageId)
                const pkg = getPackageConfig(packageId)
                setPhotoStyleSettings(pkg.defaultSettings)
              }}
            />
          )}

          {/* Photo Style Settings */}
          <StyleSettingsSection
            value={photoStyleSettings}
            onChange={setPhotoStyleSettings}
            readonlyPredefined={!!activeContext}
            originalContextSettings={originalContextSettings}
            showToggles={false}
            packageId={effectivePackageId}
            isFreePlan={isFreePlan}
            teamContext={effectiveGenerationType === 'team'}
          />

          {/* Custom Prompt */}
          {activeContext?.customPrompt && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
              <div className="pt-0">
                <h3 className="font-medium text-gray-800 mb-2">Custom Prompt</h3>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  {activeContext.customPrompt}
                </p>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}


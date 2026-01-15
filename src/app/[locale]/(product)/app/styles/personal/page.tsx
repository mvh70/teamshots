'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import StyleSummaryCard from '@/components/styles/StyleSummaryCard'
import StyleCard from '@/components/styles/StyleCard'
import UserStyleSummary from '@/components/styles/UserStyleSummary'
import { jsonFetcher } from '@/lib/fetcher'
import FreePlanBanner from '@/components/styles/FreePlanBanner'
import { usePlanInfo } from '@/hooks/usePlanInfo'
import { CardGrid, ErrorCard, Grid } from '@/components/ui'

interface Context {
  id: string
  name: string
  settings?: {
    background?: {
      key?: string
      prompt?: string
      type?: string
      color?: string
    }
    branding?: {
      logoKey?: string
      type?: string
      position?: string
    }
    clothing?: {
      style?: string
      details?: string
      accessories?: string[]
      colors?: {
        topLayer?: string
        baseLayer?: string
        bottom?: string
      }
    }
    expression?: {
      type?: string
    }
    lighting?: {
      type?: string
    }
    pose?: {
      type?: string
    }
    shotType?: {
      type?: string
    }
  }
  createdAt: string
}

interface ContextsData {
  contexts: Context[]
  activeContext?: Context
  contextType?: 'personal' | 'team'
}

export default function PersonalPhotoStylesPage() {
  const t = useTranslations('contexts')
  const { isFreePlan, tier } = usePlanInfo()
  const [contextsData, setContextsData] = useState<ContextsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success] = useState<string | null>(null)
  const [freePackageContext, setFreePackageContext] = useState<{ id: string; settings?: Context['settings']; stylePreset?: string } | null>(null)

  const fetchContexts = useCallback(async () => {
    try {
      const data = await jsonFetcher<{ contexts?: Context[]; activeContext?: Context }>('/api/styles/personal')
      setContextsData({
        contexts: data.contexts || [],
        activeContext: data.activeContext
      })
      setError(null)
    } catch {
      setError('Failed to fetch personal photo styles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContexts()
    ;(async () => {
      try {
        // Always attempt to fetch free package context so we can render its summary if available
        if (isFreePlan) {
          const freeData = await jsonFetcher<{ context: { id: string; settings?: Context['settings']; stylePreset?: string } | null }>(
            '/api/styles/get?scope=freePackage'
          )
          setFreePackageContext(freeData.context || null)
        }
      } catch {
        // Silently fail - free package context fetch is optional
      }
    })()
  }, [fetchContexts, isFreePlan])


  const handleDeleteContext = async (contextId: string) => {
    if (!confirm(t('confirmations.deleteContext'))) return

    try {
      await jsonFetcher(`/api/styles/${contextId}`, {
        method: 'DELETE'
      })
      await fetchContexts()
    } catch {
      setError(t('errors.deleteFailed'))
    }
  }

  const handleActivateContext = async (contextId: string) => {
    try {
      await jsonFetcher(`/api/styles/${contextId}/activate`, {
        method: 'POST'
      })
      await fetchContexts()
    } catch {
      setError(t('errors.activateFailed'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (error) {
    return <ErrorCard message={error} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 id="personal-photo-styles-heading" className="text-2xl font-bold text-gray-900">
              {t('labels.personalPhotoStyles')}
            </h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-brand-premium/10 text-brand-premium">
              {t('labels.personalStyles')}
            </span>
          </div>
          <p className="text-gray-600 mt-1">
            {tier === 'pro' ? t('subtitleProPlan') : t('subtitleIndividualPlan')}
          </p>
        </div>
        <button
          id="create-personal-style-btn"
          onClick={() => { if (!isFreePlan) window.location.href = '/app/styles/personal/create' }}
          disabled={isFreePlan}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isFreePlan ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-brand-primary text-white hover:bg-brand-primary-hover'}`}
        >
          <PlusIcon className="h-5 w-5" />
          {t('labels.createPersonalStyle')}
        </button>
      </div>


      {/* Success Message */}
      {success && (
        <div className="bg-brand-secondary/10 border border-brand-secondary/20 rounded-lg p-4">
          <p className="text-brand-secondary">{success}</p>
        </div>
      )}

      {/* Contexts List */}
      {isFreePlan ? (
        <CardGrid gap="lg">
          <FreePlanBanner variant="personal" className="col-span-1 md:col-span-2 lg:col-span-3" />
          <div className="rounded-lg border-2 p-6 border-brand-secondary bg-white">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{t('labels.freePackageStyle')}</h3>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-premium/10 text-brand-premium">
                  {t('labels.personal')}
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-secondary/10 text-brand-secondary">
                  {t('labels.default')}
                </span>
              </div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold border border-brand-cta/30 bg-brand-cta-light text-brand-cta uppercase tracking-wide">
                {t('freePlan.stamp')}
              </span>
            </div>
            <StyleCard
              settings={freePackageContext?.settings}
            />
          </div>
        </CardGrid>
      ) : (
        <CardGrid gap="lg">
        {contextsData?.contexts.map((context) => (
          <div
            key={context.id}
            className={`rounded-lg border-2 p-6 ${
              contextsData.activeContext?.id === context.id
                ? 'border-brand-secondary bg-white'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{context.name}</h3>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-premium/10 text-brand-premium">
                  {t('labels.personal')}
                </span>
                {contextsData.activeContext?.id === context.id && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-secondary/10 text-brand-secondary">
                    {t('labels.default')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.location.href = `/app/styles/personal/${context.id}/edit`
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteContext(context.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <Grid cols={{ mobile: 2 }} gap="md" className="text-sm text-gray-600">
              {/* Left Column - Photo Style Settings */}
              <StyleSummaryCard
                settings={context.settings}
              />

              {/* Right Column - User Style Settings */}
              <UserStyleSummary settings={context.settings as Parameters<typeof UserStyleSummary>[0]['settings']} />
            </Grid>


            <div className="mt-4 flex gap-2">
              {contextsData.activeContext?.id !== context.id && (
                <button
                  onClick={() => handleActivateContext(context.id)}
                  className="flex-1 px-3 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover text-sm"
                >
                  {t('buttons.setAsDefault')}
                </button>
              )}
            </div>
          </div>
        ))}
      </CardGrid>
      )}

    </div>
  )
}

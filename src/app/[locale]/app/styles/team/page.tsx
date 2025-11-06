'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import StyleSummaryCard from '@/components/styles/StyleSummaryCard'
import UserStyleSummary from '@/components/styles/UserStyleSummary'
import { jsonFetcher } from '@/lib/fetcher'
import FreePlanBanner from '@/components/styles/FreePlanBanner'
import { usePlanInfo } from '@/hooks/usePlanInfo'

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
        topCover?: string
        topBase?: string
        bottom?: string
      }
    }
    expression?: {
      type?: string
    }
    lighting?: {
      type?: string
    }
  }
  // Legacy fields for backward compatibility
  backgroundUrl?: string
  backgroundPrompt?: string
  logoUrl?: string
  stylePreset: string
  customPrompt?: string
  createdAt: string
}

interface ContextsData {
  contexts: Context[]
  activeContext?: Context
  contextType?: 'personal' | 'team'
}

export default function TeamPhotoStylesPage() {
  const t = useTranslations('contexts')
  const { isFreePlan } = usePlanInfo()
  const [contextsData, setContextsData] = useState<ContextsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success] = useState<string | null>(null)
  const [freePackageContext, setFreePackageContext] = useState<{ id: string; settings?: Context['settings']; stylePreset?: string } | null>(null)

  const fetchContexts = useCallback(async () => {
    try {
      const data = await jsonFetcher<{ contexts?: Context[]; activeContext?: Context }>('/api/styles/team')
      setContextsData({
        contexts: data.contexts || [],
        activeContext: data.activeContext
      })
      setError(null)
    } catch {
      setError('Failed to fetch team photo styles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContexts()
    ;(async () => {
      try {
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
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Team Photo Styles
            </h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-brand-primary-light text-brand-primary">
              Team Styles
            </span>
          </div>
          <p className="text-gray-600 mt-1">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={() => { if (!isFreePlan) window.location.href = '/app/styles/team/create' }}
          disabled={isFreePlan}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isFreePlan ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-brand-primary text-white hover:bg-brand-primary-hover'}`}
        >
          <PlusIcon className="h-5 w-5" />
          Create Team Style
        </button>
      </div>

      {/* Warning when no active context - only show for paid plans (free plan uses free package style) */}
      {!isFreePlan && !contextsData?.activeContext && (
        <div className="bg-brand-cta-light border border-brand-cta/20 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-brand-cta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-brand-cta font-medium">
              No Active Team Style
            </span>
          </div>
          <p className="text-brand-cta text-sm mt-1">
            Set an active team style to enable team member invitations and ensure consistent team photo generation.
          </p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-brand-secondary/10 border border-brand-secondary/20 rounded-lg p-4">
          <p className="text-brand-secondary">{success}</p>
        </div>
      )}

      {/* Contexts List */}
      {isFreePlan ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FreePlanBanner variant="team" className="col-span-1 md:col-span-2 lg:col-span-3" />
          <div className="rounded-lg border-2 p-6 border-brand-secondary bg-white">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Free Package Style</h3>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-primary-light text-brand-primary">
                  Team
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-secondary/10 text-brand-secondary">
                  Default
                </span>
              </div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold border border-brand-cta/30 bg-brand-cta-light text-brand-cta uppercase tracking-wide">
                {t('freePlan.stamp')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <StyleSummaryCard
                settings={freePackageContext?.settings}
                stylePreset={freePackageContext?.stylePreset || 'corporate'}
              />
              <UserStyleSummary settings={freePackageContext?.settings as Parameters<typeof UserStyleSummary>[0]['settings']} />
            </div>
            
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-primary-light text-brand-primary">
                  Team
                </span>
                {contextsData.activeContext?.id === context.id && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-secondary/10 text-brand-secondary">
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.location.href = `/app/styles/team/${context.id}/edit`
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

            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              {/* Left Column - Photo Style Settings */}
              <StyleSummaryCard
                settings={context.settings}
                stylePreset={context.stylePreset}
                legacyBackgroundUrl={context.backgroundUrl}
                legacyBackgroundPrompt={context.backgroundPrompt}
                legacyLogoUrl={context.logoUrl}
              />

              {/* Right Column - User Style Settings */}
              <UserStyleSummary settings={context.settings as Parameters<typeof UserStyleSummary>[0]['settings']} />
            </div>


            <div className="mt-4 flex gap-2">
              {contextsData.activeContext?.id !== context.id && (
                <button
                  onClick={() => handleActivateContext(context.id)}
                  className="flex-1 px-3 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover text-sm"
                >
                  Set as Default
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

    </div>
  )
}

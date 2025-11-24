'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import StyleSummaryCard from '@/components/styles/StyleSummaryCard'
import UserStyleSummary from '@/components/styles/UserStyleSummary'
import { jsonFetcher } from '@/lib/fetcher'
import FreePlanBanner from '@/components/styles/FreePlanBanner'
import { usePlanInfo } from '@/hooks/usePlanInfo'
import { ErrorCard } from '@/components/ui'

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
    return <ErrorCard message={error} />
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <h1 id="team-photo-styles-heading" className="text-3xl font-bold text-gray-900">
              Team Photo Styles
            </h1>
            <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-brand-primary to-brand-primary-hover text-white shadow-sm">
              Team Styles
            </span>
          </div>
          <p className="text-gray-600 text-lg">
            {t('subtitle')}
          </p>
        </div>
        <button
          id="create-team-style-btn"
          onClick={() => { if (!isFreePlan) window.location.href = '/app/styles/team/create' }}
          disabled={isFreePlan}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
            isFreePlan 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : 'bg-gradient-to-r from-brand-primary to-brand-primary-hover text-white hover:shadow-lg hover:scale-105'
          }`}
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
        <div className="space-y-6">
          <FreePlanBanner variant="team" />
          <div className="relative overflow-hidden rounded-2xl border-2 border-brand-secondary/30 bg-white shadow-lg max-w-5xl">
            {/* Decorative background */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-gradient-to-br from-brand-secondary/10 to-brand-primary/10 blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-gradient-to-tr from-brand-primary/5 to-brand-secondary/5 blur-2xl" />
            
            <div className="relative p-8">
              {/* Header */}
              <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-2xl font-bold text-gray-900">Free Package Style</h3>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-primary to-brand-primary-hover text-white shadow-sm">
                      Team
                    </span>
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-secondary to-brand-secondary-hover text-white shadow-sm">
                      Default
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border-2 border-brand-cta/30 bg-gradient-to-r from-brand-cta-light to-orange-50 text-brand-cta uppercase tracking-wider shadow-sm">
                  {t('freePlan.stamp')}
                </span>
              </div>
              
              {/* Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StyleSummaryCard
                  settings={freePackageContext?.settings}
                />
                <UserStyleSummary settings={freePackageContext?.settings as Parameters<typeof UserStyleSummary>[0]['settings']} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
        {contextsData?.contexts.map((context) => (
          <div
            key={context.id}
            className={`relative overflow-hidden rounded-2xl border-2 shadow-lg transition-all hover:shadow-xl max-w-5xl ${
              contextsData.activeContext?.id === context.id
                ? 'border-brand-secondary/40 bg-white'
                : 'border-gray-200 bg-white'
            }`}
          >
            {/* Decorative background */}
            {contextsData.activeContext?.id === context.id && (
              <>
                <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-gradient-to-br from-brand-secondary/10 to-brand-primary/10 blur-2xl" />
                <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-gradient-to-tr from-brand-primary/5 to-brand-secondary/5 blur-2xl" />
              </>
            )}
            
            <div className="relative p-8">
              {/* Header */}
              <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-200">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-2xl font-bold text-gray-900">{context.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-primary to-brand-primary-hover text-white shadow-sm">
                      Team
                    </span>
                    {contextsData.activeContext?.id === context.id && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-secondary to-brand-secondary-hover text-white shadow-sm">
                        Default
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      window.location.href = `/app/styles/team/${context.id}/edit`
                    }}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Edit style"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteContext(context.id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete style"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

                                            {/* Grid */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                 <StyleSummaryCard
                   settings={context.settings}
                 />
                 <UserStyleSummary settings={context.settings as Parameters<typeof UserStyleSummary>[0]['settings']} />
               </div>

              {/* Actions */}
              {contextsData.activeContext?.id !== context.id && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleActivateContext(context.id)}
                    className="w-full px-6 py-3 bg-gradient-to-r from-brand-primary to-brand-primary-hover text-white rounded-xl hover:shadow-lg transition-all font-semibold"
                  >
                    Set as Default
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

    </div>
  )
}

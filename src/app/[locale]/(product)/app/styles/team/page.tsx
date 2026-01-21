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
  packageId?: string
  settings?: Record<string, unknown>
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
        // Silently fail
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

  // Add New Style Card Component
  const AddNewStyleCard = () => (
    <button
      onClick={() => { if (!isFreePlan) window.location.href = '/app/styles/team/create' }}
      disabled={isFreePlan}
      aria-label="Create new team style"
      className={`group relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 max-w-5xl w-full text-left ${
        isFreePlan
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
          : 'border-brand-primary/30 bg-gradient-to-br from-brand-primary/[0.02] via-white to-brand-secondary/[0.02] hover:border-brand-primary/50 hover:shadow-lg hover:shadow-brand-primary/10 cursor-pointer'
      }`}
    >
      {/* Decorative background on hover */}
      {!isFreePlan && (
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}

      <div className="relative p-8 flex items-center gap-6">
        {/* Icon */}
        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
          isFreePlan
            ? 'bg-gray-100'
            : 'bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 group-hover:from-brand-primary/20 group-hover:to-brand-secondary/20 group-hover:scale-110'
        }`}>
          <PlusIcon className={`h-7 w-7 transition-colors ${isFreePlan ? 'text-gray-400' : 'text-brand-primary'}`} strokeWidth={2} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-bold transition-colors ${isFreePlan ? 'text-gray-400' : 'text-gray-900 group-hover:text-brand-primary'}`}>
            Create New Style
          </h3>
          <p className={`text-sm mt-1 ${isFreePlan ? 'text-gray-400' : 'text-gray-500'}`}>
            Add another team photo style with custom settings
          </p>
        </div>

        {/* Arrow indicator */}
        {!isFreePlan && (
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
            <svg className="w-6 h-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>
    </button>
  )

  return (
    <div className="space-y-10">
      {/* Header - simplified without create button */}
      <div className="space-y-2">
        <h1 id="team-photo-styles-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          Team Photo Styles
        </h1>
        <p className="text-gray-600 text-base sm:text-lg font-medium leading-relaxed max-w-2xl">
          {t('subtitle')}
        </p>
      </div>

      {/* Warning when no active context */}
      {!isFreePlan && !contextsData?.activeContext && contextsData?.contexts && contextsData.contexts.length > 0 && (
        <div className="bg-gradient-to-r from-brand-cta-light via-orange-50 to-brand-cta-light border-2 border-brand-cta/30 rounded-xl p-5 shadow-md shadow-brand-cta/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-cta/10 flex items-center justify-center flex-shrink-0">
              <svg className="h-6 w-6 text-brand-cta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-brand-cta font-bold text-base block">
                No Active Team Style
              </span>
              <p className="text-brand-cta/90 text-sm mt-1 leading-relaxed">
                Set an active team style to enable team member invitations and ensure consistent team photo generation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-gradient-to-r from-brand-secondary/10 via-green-50 to-brand-secondary/10 border-2 border-brand-secondary/30 rounded-xl p-5 shadow-md shadow-brand-secondary/10">
          <p className="text-brand-secondary font-semibold">{success}</p>
        </div>
      )}

      {/* Contexts List */}
      {isFreePlan ? (
        <div className="space-y-8">
          <FreePlanBanner variant="team" />
          <div className="relative overflow-hidden rounded-3xl border-2 border-brand-secondary/30 bg-white shadow-xl shadow-brand-secondary/10 max-w-5xl transition-all duration-300 hover:shadow-2xl hover:shadow-brand-secondary/15">
            {/* Decorative background */}
            <div className="absolute top-0 right-0 -mt-12 -mr-12 h-40 w-40 rounded-full bg-gradient-to-br from-brand-secondary/15 to-brand-primary/15 blur-3xl animate-pulse motion-reduce:animate-none" style={{ animationDuration: '4s' }} />
            <div className="absolute bottom-0 left-0 -mb-12 -ml-12 h-40 w-40 rounded-full bg-gradient-to-tr from-brand-primary/10 to-brand-secondary/10 blur-3xl animate-pulse motion-reduce:animate-none" style={{ animationDuration: '5s', animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 blur-3xl opacity-50" />

            <div className="relative p-8 md:p-10">
              {/* Header */}
              <div className="flex items-start justify-between mb-10 pb-7 border-b border-gray-200/60">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-2xl font-display font-bold text-gray-900 tracking-tight">Free Package Style</h3>
                  <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-brand-secondary to-brand-secondary-hover text-white shadow-sm shadow-brand-secondary/20">
                    Default
                  </span>
                </div>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border-2 border-brand-cta/30 bg-gradient-to-r from-brand-cta-light to-orange-50 text-brand-cta uppercase tracking-wider shadow-sm">
                  {t('freePlan.stamp')}
                </span>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
                <StyleSummaryCard
                  settings={freePackageContext?.settings}
                  packageId="freepackage"
                />
                <UserStyleSummary settings={freePackageContext?.settings as Parameters<typeof UserStyleSummary>[0]['settings']} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {contextsData?.contexts.length === 0 ? (
            // Empty state - prominent create card
            <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-white p-16 text-center max-w-3xl mx-auto">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5 blur-2xl" />
              <div className="relative">
                <div className="h-16 w-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 flex items-center justify-center">
                  <PlusIcon className="h-8 w-8 text-brand-primary" />
                </div>
                <h3 className="text-xl font-display font-bold text-gray-900 mb-2">No Team Styles Yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Create your first team photo style to ensure consistent, professional photos across your team.
                </p>
                <button
                  onClick={() => window.location.href = '/app/styles/team/create'}
                  aria-label="Create your first team style"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-primary text-white shadow-lg shadow-brand-primary/30 hover:shadow-xl hover:shadow-brand-primary/40 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/50"
                >
                  <PlusIcon className="h-5 w-5" aria-hidden="true" />
                  Create Your First Style
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Existing styles */}
              {contextsData?.contexts.map((context) => (
                <div
                  key={context.id}
                  className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-300 max-w-5xl group ${
                    contextsData.activeContext?.id === context.id
                      ? 'border-brand-secondary/50 bg-white shadow-xl shadow-brand-secondary/15 hover:shadow-2xl hover:shadow-brand-secondary/20'
                      : 'border-gray-200/60 bg-white shadow-lg shadow-gray-200/30 hover:shadow-xl hover:shadow-gray-300/40 hover:border-gray-300/80'
                  }`}
                >
                  {/* Decorative background */}
                  {contextsData.activeContext?.id === context.id && (
                    <>
                      <div className="absolute top-0 right-0 -mt-12 -mr-12 h-40 w-40 rounded-full bg-gradient-to-br from-brand-secondary/15 to-brand-primary/15 blur-3xl animate-pulse motion-reduce:animate-none" style={{ animationDuration: '4s' }} />
                      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 h-40 w-40 rounded-full bg-gradient-to-tr from-brand-primary/10 to-brand-secondary/10 blur-3xl animate-pulse motion-reduce:animate-none" style={{ animationDuration: '5s', animationDelay: '1s' }} />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 blur-3xl opacity-50" />
                    </>
                  )}
                  {contextsData.activeContext?.id !== context.id && (
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 h-24 w-24 rounded-full bg-gradient-to-br from-gray-100/40 to-gray-200/40 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}

                  <div className="relative p-8">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-200/60">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-2xl font-display font-bold text-gray-900 tracking-tight">{context.name}</h3>
                        {contextsData.activeContext?.id === context.id && (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-brand-secondary to-brand-secondary-hover text-white shadow-sm shadow-brand-secondary/20">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            window.location.href = `/app/styles/team/${context.id}/edit`
                          }}
                          className="p-2.5 rounded-xl text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50"
                          aria-label={`Edit ${context.name} style`}
                        >
                          <PencilIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDeleteContext(context.id)}
                          className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                          aria-label={`Delete ${context.name} style`}
                        >
                          <TrashIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 mb-8">
                      <StyleSummaryCard
                        settings={context.settings}
                        packageId={context.packageId}
                      />
                      <UserStyleSummary settings={context.settings as Parameters<typeof UserStyleSummary>[0]['settings']} />
                    </div>

                    {/* Actions */}
                    {contextsData.activeContext?.id !== context.id && (
                      <div className="pt-5 border-t border-gray-200/60">
                        <button
                          onClick={() => handleActivateContext(context.id)}
                          aria-label={`Set ${context.name} as default style`}
                          className="w-full px-6 py-3.5 bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-primary text-white rounded-xl hover:shadow-xl hover:shadow-brand-primary/30 transition-all duration-300 font-bold text-sm hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/50"
                        >
                          Set as Default
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Add New Style Card - at the end of the list */}
              <AddNewStyleCard />
            </>
          )}
        </div>
      )}
    </div>
  )
}

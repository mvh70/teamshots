'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { jsonFetcher } from '@/lib/fetcher'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import FreePlanBanner from '@/components/styles/FreePlanBanner'
import StyleCard from '@/components/styles/StyleCard'
import StyleForm from '@/components/styles/StyleForm'
import Panel from '@/components/common/Panel'
import { PhotoStyleSettings as PhotoStyleSettingsType } from '@/types/photo-style'
import { usePlanInfo } from '@/hooks/usePlanInfo'

interface Context {
  id: string
  name: string
  settings?: PhotoStyleSettingsType
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

export default function ContextsPage() {
  const t = useTranslations('contexts')
  const { isFreePlan } = usePlanInfo()
  const [contextsData, setContextsData] = useState<ContextsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingContext, setEditingContext] = useState<Context | null>(null)
  const [isTeamAdmin, setIsTeamAdmin] = useState(false)
  const [freePackageContext, setFreePackageContext] = useState<{ id: string; settings?: Context['settings']; stylePreset?: string } | null>(null)


  const fetchContexts = useCallback(async () => {
    try {
      const data = await jsonFetcher<ContextsData>('/api/styles')
      setContextsData(data)
    } catch {
      setError(t('errors.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])



  useEffect(() => {
    fetchContexts()
    fetchUserRole()
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

  const fetchUserRole = async () => {
    try {
      const data = await jsonFetcher<{ userRole: { isTeamAdmin: boolean } }>('/api/dashboard/stats')
      setIsTeamAdmin(data.userRole.isTeamAdmin)
    } catch (err) {
      console.error('Failed to fetch user role:', err)
    }
  }

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

  if (success) {
    return (
      <div className="bg-brand-secondary/10 border border-brand-secondary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <p className="text-brand-secondary">{success}</p>
          <button
            onClick={() => {
              setSuccess(null)
              setEditingContext(null)
            }}
            className="text-brand-secondary hover:text-brand-secondary-hover font-medium"
          >
            {t('actions.close')}
          </button>
        </div>
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
              {t('title')}
            </h1>
            {contextsData?.contextType && (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                contextsData.contextType === 'team' 
                  ? 'bg-brand-primary-light text-brand-primary' 
                  : 'bg-brand-premium/10 text-brand-premium'
              }`}>
                {contextsData.contextType === 'team' ? 'Team Contexts' : 'Personal Contexts'}
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">
            {isTeamAdmin ? t('subtitle') : t('subtitleIndividual')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (!isFreePlan) setShowCreateForm(true) }}
            disabled={isFreePlan}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isFreePlan ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-brand-primary text-white hover:bg-brand-primary-hover'}`}
          >
            <PlusIcon className="h-5 w-5" />
            {t('createContext')}
          </button>
        </div>
      </div>

      {/* Warning when no active context - only for team mode and paid plans (free plan uses free package style) */}
      {isTeamAdmin && !isFreePlan && !contextsData?.activeContext && (
        <div className="bg-brand-cta-light border border-brand-cta/20 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-brand-cta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-brand-cta font-medium">
              {t('status.noActiveContext')}
            </span>
          </div>
          <p className="text-brand-cta text-sm mt-1">
            {t('status.mustSetActive')}
          </p>
        </div>
      )}

      {/* Contexts List */}
      {isFreePlan ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FreePlanBanner variant="generic" className="col-span-1 md:col-span-2 lg:col-span-3" />
          <div className="rounded-lg border-2 p-6 border-brand-secondary bg-white">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Free Package Style</h3>
                {contextsData?.contextType && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    contextsData.contextType === 'team' 
                      ? 'bg-brand-primary-light text-brand-primary' 
                      : 'bg-brand-premium/10 text-brand-premium'
                  }`}>
                    {contextsData.contextType === 'team' ? 'Team' : 'Personal'}
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-secondary/10 text-brand-secondary">
                  {t('status.active')}
                </span>
              </div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold border border-brand-cta/30 bg-brand-cta-light text-brand-cta uppercase tracking-wide">
                {t('freePlan.stamp')}
              </span>
            </div>
            <StyleCard
              settings={freePackageContext?.settings}
              stylePreset={freePackageContext?.stylePreset || 'corporate'}
            />
            
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
                {contextsData.contextType && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    contextsData.contextType === 'team' 
                      ? 'bg-brand-primary-light text-brand-primary' 
                      : 'bg-brand-premium/10 text-brand-premium'
                  }`}>
                    {contextsData.contextType === 'team' ? 'Team' : 'Personal'}
                  </span>
                )}
                {contextsData.activeContext?.id === context.id && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-secondary/10 text-brand-secondary">
                    {t('status.active')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingContext(context)}
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

            <StyleCard
              settings={context.settings}
              stylePreset={context.stylePreset}
              legacyBackgroundUrl={context.backgroundUrl}
              legacyBackgroundPrompt={context.backgroundPrompt}
              legacyLogoUrl={context.logoUrl}
            />

            {contextsData.activeContext?.id !== context.id && (
              <button
                onClick={() => handleActivateContext(context.id)}
                className="w-full mt-4 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                {contextsData?.contextType === 'team' ? t('buttons.setAsActive') : t('buttons.setAsDefault')}
              </button>
            )}
          </div>
        ))}
      </div>
      )}

      {/* Create/Edit Form - Inline (DRY via StyleForm) */}
      {(showCreateForm || editingContext) && (
        <Panel
          title={editingContext ? 'Edit Photo Style Settings' : 'Create Photo Style Settings'}
          subtitle="Background, branding, and overall photo style"
          onClose={() => {
            setShowCreateForm(false)
            setEditingContext(null)
          }}
        >
          <StyleForm
            mode={editingContext ? 'edit' : 'create'}
            contextType={(contextsData?.contextType === 'team' ? 'team' : 'personal')}
            backUrl="/app/styles"
            scope={(contextsData?.contextType === 'team' ? 'pro' : 'individual')}
            contextId={editingContext?.id}
            hideFormCard
            hideMessages
          />
        </Panel>
      )}
    </div>
  )
}

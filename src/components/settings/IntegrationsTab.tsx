'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { jsonFetcher } from '@/lib/fetcher'
import {
  ClipboardIcon,
  TrashIcon,
  PlusIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  LinkIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  UserPlusIcon,
  BoltIcon
} from '@heroicons/react/24/outline'
import { getCleanClientBaseUrl } from '@/lib/url'

interface ApiKey {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
  is_revoked: boolean
  masked_prefix: string
}

interface IntegrationsTabProps {
  teamId?: string
}

export default function IntegrationsTab({ teamId }: IntegrationsTabProps) {
  const t = useTranslations('app.settings.integrations')
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null)

  const webhookUrl = `${getCleanClientBaseUrl()}/api/integrations/zapier/invite`

  const loadApiKeys = useCallback(async () => {
    try {
      setError(null)
      const data = await jsonFetcher<{ success: boolean; keys: ApiKey[] }>(
        '/api/integrations/zapier/keys'
      )
      setApiKeys(data.keys.filter((k) => !k.is_revoked))
    } catch (err) {
      setError(t('errors.loadFailed', { default: 'Failed to load API keys' }))
      console.error('Failed to load API keys:', err)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (teamId) {
      loadApiKeys()
    }
  }, [teamId, loadApiKeys])

  const handleCreateKey = async () => {
    if (creating) return

    setCreating(true)
    setError(null)

    try {
      const data = await jsonFetcher<{
        success: boolean
        key: { id: string; name: string; api_key: string; created_at: string }
      }>('/api/integrations/zapier/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'Default' })
      })

      setNewlyCreatedKey(data.key.api_key)
      setNewKeyName('')
      setShowCreateForm(false)
      await loadApiKeys()
    } catch (err) {
      setError(t('errors.createFailed', { default: 'Failed to create API key' }))
      console.error('Failed to create API key:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    if (deletingKeyId) return

    if (!confirm(t('confirmDelete', { default: 'Are you sure you want to revoke this API key? This action cannot be undone.' }))) {
      return
    }

    setDeletingKeyId(keyId)
    setError(null)

    try {
      await jsonFetcher(`/api/integrations/zapier/keys/${keyId}`, {
        method: 'DELETE'
      })
      await loadApiKeys()
    } catch (err) {
      setError(t('errors.deleteFailed', { default: 'Failed to revoke API key' }))
      console.error('Failed to delete API key:', err)
    } finally {
      setDeletingKeyId(null)
    }
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      console.error('Failed to copy to clipboard')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('neverUsed', { default: 'Never used' })
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero Section - Value Proposition */}
      <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-2xl border border-orange-100 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="p-4 bg-white rounded-xl shadow-sm border border-orange-100">
            <BoltIcon className="w-10 h-10 text-orange-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('zapier.heroTitle', { default: 'Automate Team Invites' })}
            </h2>
            <p className="text-gray-600 mb-4 leading-relaxed">
              {t('zapier.heroDescription', {
                default:
                  'Connect your HR system to TeamShots and automatically invite new employees. When someone joins in BambooHR, Workday, or Slack, they get an instant invite to create their professional headshot.'
              })}
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <SparklesIcon className="h-5 w-5 text-orange-500" />
                <span>{t('zapier.benefit1', { default: 'Zero manual work' })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <UserPlusIcon className="h-5 w-5 text-orange-500" />
                <span>{t('zapier.benefit2', { default: 'Instant invites' })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckIcon className="h-5 w-5 text-orange-500" />
                <span>{t('zapier.benefit3', { default: 'Works with 5000+ apps' })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Integration Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* How It Works Section */}
        <div className="p-6 sm:p-8 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('zapier.howItWorksTitle', { default: 'How It Works' })}
          </h3>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {t('zapier.howStep1Title', { default: 'Connect Your HR System' })}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {t('zapier.howStep1Desc', { default: 'Link BambooHR, Workday, Slack, or any app that triggers when employees are added.' })}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {t('zapier.howStep2Title', { default: 'Set Up the Webhook' })}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {t('zapier.howStep2Desc', { default: 'Copy the webhook URL and API key below into your Zapier workflow.' })}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {t('zapier.howStep3Title', { default: 'Automatic Invites' })}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {t('zapier.howStep3Desc', { default: 'New employees automatically receive an invite email to create their headshot.' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 sm:mx-8 mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Webhook URL Section */}
        <div className="p-6 sm:p-8 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('zapier.configTitle', { default: 'Configuration' })}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <LinkIcon className="h-4 w-4 inline mr-1.5" />
                {t('zapier.webhookUrl', { default: 'Webhook URL' })}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                  title={t('copy', { default: 'Copy to clipboard' })}
                >
                  {copiedField === 'webhook' ? (
                    <>
                      <CheckIcon className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">{t('copied', { default: 'Copied!' })}</span>
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="h-4 w-4" />
                      <span className="text-sm">{t('copy', { default: 'Copy' })}</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {t('zapier.webhookHelp', {
                  default: 'Use this URL as the webhook destination in Zapier with POST method.'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Newly Created Key Warning */}
        {newlyCreatedKey && (
          <div className="mx-6 sm:mx-8 mt-6 bg-amber-50 border-2 border-amber-300 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-amber-800 font-semibold mb-2">
                  {t('zapier.newKeyWarning', {
                    default: 'Save this API key now!'
                  })}
                </p>
                <p className="text-amber-700 text-sm mb-3">
                  {t('zapier.newKeyWarningDesc', {
                    default: 'This key will only be shown once. Copy it and store it securely.'
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-white border-2 border-amber-200 rounded-lg text-sm font-mono text-amber-900 break-all">
                    {newlyCreatedKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newlyCreatedKey, 'newKey')}
                    className="px-4 py-3 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors flex-shrink-0"
                  >
                    {copiedField === 'newKey' ? (
                      <CheckIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <ClipboardIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => setNewlyCreatedKey(null)}
                  className="mt-4 text-sm text-amber-700 hover:text-amber-900 font-medium underline"
                >
                  {t('zapier.dismissKeyWarning', { default: "I've saved this key securely" })}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Keys Section */}
        <div className="p-6 sm:p-8 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                <KeyIcon className="h-5 w-5 inline mr-2" />
                {t('zapier.apiKeys', { default: 'API Keys' })}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('zapier.apiKeysDesc', { default: 'Create and manage API keys for your Zapier integration.' })}
              </p>
            </div>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 rounded-lg transition-colors shadow-sm"
              >
                <PlusIcon className="h-4 w-4" />
                {t('zapier.createKey', { default: 'Create API Key' })}
              </button>
            )}
          </div>

          {/* Create Key Form */}
          {showCreateForm && (
            <div className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-xl">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('zapier.keyName', { default: 'Key Name (optional)' })}
              </label>
              <p className="text-xs text-gray-500 mb-3">
                {t('zapier.keyNameHelp', { default: 'Give your key a descriptive name to remember what it\'s used for.' })}
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder={t('zapier.keyNamePlaceholder', { default: 'e.g., BambooHR Integration' })}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                />
                <button
                  onClick={handleCreateKey}
                  disabled={creating}
                  className="px-5 py-2.5 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating
                    ? t('zapier.creating', { default: 'Creating...' })
                    : t('zapier.create', { default: 'Create' })}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewKeyName('')
                  }}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  {t('cancel', { default: 'Cancel' })}
                </button>
              </div>
            </div>
          )}

          {/* Keys List */}
          {apiKeys.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <KeyIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">
                {t('zapier.noKeys', { default: 'No API keys yet' })}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                {t('zapier.noKeysDesc', { default: 'Create your first API key to start automating invites.' })}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden border border-gray-200 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('zapier.table.name', { default: 'Name' })}
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('zapier.table.created', { default: 'Created' })}
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('zapier.table.lastUsed', { default: 'Last Used' })}
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {t('zapier.table.actions', { default: 'Actions' })}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {key.name}
                          </span>
                          <span className="px-2 py-0.5 text-xs text-gray-400 font-mono bg-gray-100 rounded">
                            {key.masked_prefix}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(key.created_at)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(key.last_used_at)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDeleteKey(key.id)}
                          disabled={deletingKeyId === key.id}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 p-2 rounded-lg transition-colors"
                          title={t('zapier.revokeKey', { default: 'Revoke API key' })}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detailed Setup Instructions */}
        <div className="p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('zapier.detailedSetupTitle', { default: 'Detailed Setup Instructions' })}
          </h3>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-xs">
                1
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 mb-1">
                  {t('zapier.detailedStep1Title', { default: 'Create an API key' })}
                </p>
                <p className="text-sm text-gray-600">
                  {t('zapier.detailedStep1Desc', { default: 'Click "Create API Key" above and save the key securely. You\'ll need it for the Zapier configuration.' })}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 mb-1">
                  {t('zapier.detailedStep2Title', { default: 'Open Zapier and create a new Zap' })}
                </p>
                <p className="text-sm text-gray-600">
                  {t('zapier.detailedStep2Desc', { default: 'Go to zapier.com and create a new Zap. Choose your HR system (BambooHR, Workday, etc.) as the trigger, with "New Employee" as the trigger event.' })}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-xs">
                3
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 mb-1">
                  {t('zapier.detailedStep3Title', { default: 'Add "Webhooks by Zapier" as the action' })}
                </p>
                <p className="text-sm text-gray-600">
                  {t('zapier.detailedStep3Desc', { default: 'Search for "Webhooks by Zapier" and select it. Choose "POST" as the action event.' })}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-xs">
                4
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 mb-1">
                  {t('zapier.detailedStep4Title', { default: 'Configure the webhook' })}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  {t('zapier.detailedStep4Desc', { default: 'Paste the webhook URL from above. Set "Payload Type" to "json" and add the following fields:' })}
                </p>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-100 font-mono">{`{
  "email": "{{employee_email}}",
  "first_name": "{{employee_first_name}}",
  "last_name": "{{employee_last_name}}",
  "api_key": "zap_your_api_key_here"
}`}</pre>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {t('zapier.detailedStep4Note', { default: 'Replace the placeholders with the actual fields from your HR system trigger.' })}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-xs">
                5
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 mb-1">
                  {t('zapier.detailedStep5Title', { default: 'Test and publish' })}
                </p>
                <p className="text-sm text-gray-600">
                  {t('zapier.detailedStep5Desc', { default: 'Test your Zap to make sure everything works, then turn it on. New employees will automatically receive headshot invites!' })}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <a
              href="https://zapier.com/apps/webhook"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-primary hover:underline"
            >
              {t('zapier.learnMore', { default: 'Learn more about Webhooks by Zapier' })}
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

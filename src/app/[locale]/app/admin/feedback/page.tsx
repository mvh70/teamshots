'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { formatDate } from '@/lib/format'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

interface FeedbackItem {
  id: string
  type: 'general' | 'generation'
  rating: 'up' | 'down'
  comment: string | null
  context: 'landing' | 'dashboard' | 'generation'
  options: string[] | null
  resolved: boolean
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  person: {
    id: string
    email: string | null
    firstName: string
    lastName: string | null
  } | null
  email: string | null
  generation: {
    id: string
    status: string
    createdAt: string
  } | null
  generationId: string | null
}

interface FeedbackResponse {
  success: boolean
  data: {
    feedback: FeedbackItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

export default function AdminFeedbackPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const t = useTranslations('feedback.admin')
  const tFeedback = useTranslations('feedback')
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    type: '',
    rating: '',
    resolved: '',
    context: '',
  })

  const fetchFeedback = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      })
      if (filters.type) params.set('type', filters.type)
      if (filters.rating) params.set('rating', filters.rating)
      if (filters.resolved) params.set('resolved', filters.resolved)
      if (filters.context) params.set('context', filters.context)

      const response = await fetch(`/api/admin/feedback?${params.toString()}`)
      if (response.ok) {
        const data: FeedbackResponse = await response.json()
        setFeedback(data.data.feedback)
        setTotalPages(data.data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    if (status === 'loading') return

    // Check if user is admin
    if (!session?.user?.isAdmin) {
      router.push('/app/dashboard')
      return
    }

    fetchFeedback()
  }, [session, status, router, page, filters, fetchFeedback])

  const handleResolveToggle = async (feedbackId: string, currentResolved: boolean) => {
    try {
      const response = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedbackId,
          resolved: !currentResolved,
        }),
      })

      if (response.ok) {
        // Refresh feedback list
        fetchFeedback()
      }
    } catch (error) {
      console.error('Failed to update feedback:', error)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (!session?.user?.isAdmin) {
    return null // Will redirect
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <Link 
          href="/app/admin" 
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-4 group"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to admin dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
        <p className="text-gray-600">{t('description')}</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('filters.type')}
            </label>
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters({ ...filters, type: e.target.value })
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">{t('filters.all')}</option>
              <option value="general">{t('filters.general')}</option>
              <option value="generation">{t('filters.generation')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('filters.rating')}
            </label>
            <select
              value={filters.rating}
              onChange={(e) => {
                setFilters({ ...filters, rating: e.target.value })
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">{t('filters.all')}</option>
              <option value="up">{t('filters.positive')}</option>
              <option value="down">{t('filters.negative')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('filters.status')}
            </label>
            <select
              value={filters.resolved}
              onChange={(e) => {
                setFilters({ ...filters, resolved: e.target.value })
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">{t('filters.all')}</option>
              <option value="false">{t('filters.unresolved')}</option>
              <option value="true">{t('filters.resolved')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('filters.context')}
            </label>
            <select
              value={filters.context}
              onChange={(e) => {
                setFilters({ ...filters, context: e.target.value })
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">{t('filters.all')}</option>
              <option value="landing">{t('filters.landing')}</option>
              <option value="dashboard">{t('filters.dashboard')}</option>
              <option value="generation">{t('filters.generation')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feedback Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('table.date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('table.user')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('table.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('table.rating')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('table.comment')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('table.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {feedback.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {t('table.empty')}
                  </td>
                </tr>
              ) : (
                feedback.map((item) => (
                  <tr key={item.id} className={item.resolved ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.person ? (
                        <div>
                          <div className="font-medium">
                            {item.person.email || `${item.person.firstName} ${item.person.lastName || ''}`.trim()}
                          </div>
                          <div className="text-xs text-gray-500">{item.person.id}</div>
                        </div>
                      ) : item.email ? (
                        <div>
                          <div className="font-medium">{item.email}</div>
                          <div className="text-xs text-gray-500">{t('table.anonymous')}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">{t('table.anonymous')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {item.type}
                      </span>
                      {item.generation && (
                        <div className="mt-1">
                          <a
                            href={`/app/generations/${item.generation.id}`}
                            className="text-xs text-brand-primary hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t('table.viewGeneration')}
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.rating === 'up' ? (
                        <span className="text-brand-secondary-hover">👍 {tFeedback('rating.up')}</span>
                      ) : (
                        <span className="text-red-600">👎 {tFeedback('rating.down')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={item.comment || ''}>
                        {item.comment || <span className="text-gray-400">{t('table.noComment')}</span>}
                      </div>
                      {item.options && item.options.length > 0 && (
                        <div className="mt-1 text-xs text-gray-500">
                          {item.options.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.resolved ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-secondary-lighter text-brand-secondary-text">
                          {t('status.resolved')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          {t('status.unresolved')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleResolveToggle(item.id, item.resolved)}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          item.resolved
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-brand-secondary-lighter text-brand-secondary-text hover:bg-brand-secondary-border'
                        }`}
                      >
                        {item.resolved ? t('actions.unresolve') : t('actions.resolve')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              {t('pagination.page')} {page} {t('pagination.of')} {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('pagination.previous')}
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('pagination.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


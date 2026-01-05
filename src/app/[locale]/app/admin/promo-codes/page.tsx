'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Link } from '@/i18n/routing'
import {
  ArrowLeftIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

interface PromoCode {
  id: string
  code: string
  domain: string
  discountType: 'percentage' | 'fixed_amount'
  discountValue: number
  maxUses: number | null
  usedCount: number
  actualUsageCount: number
  validFrom: string
  validUntil: string | null
  active: boolean
  applicableTo: string[]
  minSeats: number | null
  stripeCouponId: string | null
  stripePromoCodeId: string | null
  createdAt: string
}

interface PromoCodeUsage {
  id: string
  userId: string | null
  email: string | null
  userName: string | null
  discountAmount: number
  originalAmount: number
  stripeSessionId: string | null
  createdAt: string
}

export default function PromoCodesAdminPage() {
  const { data: session } = useSession()
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [availableDomains, setAvailableDomains] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDomain, setSelectedDomain] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUsageModal, setShowUsageModal] = useState<{ codeId: string; code: string } | null>(null)
  const [usageData, setUsageData] = useState<{ usages: PromoCodeUsage[]; totals: { totalDiscountGiven: number; usageCount: number } } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state for creating new code
  const [newCode, setNewCode] = useState({
    code: '',
    domain: '',
    discountType: 'percentage' as 'percentage' | 'fixed_amount',
    discountValue: 50,
    maxUses: 20,
    validUntil: '',
    applicableTo: ['plan', 'seats', 'top_up'] as string[],
    minSeats: null as number | null,
  })

  const fetchPromoCodes = useCallback(async () => {
    try {
      const url = selectedDomain
        ? `/api/admin/promo-codes?domain=${encodeURIComponent(selectedDomain)}`
        : '/api/admin/promo-codes'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setPromoCodes(data.promoCodes || [])
        setAvailableDomains(data.availableDomains || [])
        if (!newCode.domain && data.availableDomains?.length > 0) {
          setNewCode(prev => ({ ...prev, domain: data.availableDomains[0] }))
        }
      }
    } catch (err) {
      console.error('Failed to fetch promo codes:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedDomain, newCode.domain])

  useEffect(() => {
    if (session?.user?.isAdmin) {
      fetchPromoCodes()
    } else {
      setLoading(false)
    }
  }, [session?.user?.isAdmin, fetchPromoCodes])

  const handleCreateCode = async () => {
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCode,
          maxUses: newCode.maxUses || null,
          validUntil: newCode.validUntil || null,
          minSeats: newCode.minSeats || null,
        }),
      })

      if (response.ok) {
        setSuccess(`Promo code "${newCode.code}" created successfully!`)
        setShowCreateModal(false)
        setNewCode({
          code: '',
          domain: availableDomains[0] || '',
          discountType: 'percentage',
          discountValue: 50,
          maxUses: 20,
          validUntil: '',
          applicableTo: ['plan', 'seats', 'top_up'],
          minSeats: null,
        })
        fetchPromoCodes()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create promo code')
      }
    } catch {
      setError('Failed to create promo code')
    }
  }

  const handleToggleActive = async (code: PromoCode) => {
    try {
      const response = await fetch(`/api/admin/promo-codes/${code.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !code.active }),
      })

      if (response.ok) {
        setSuccess(`Promo code "${code.code}" ${!code.active ? 'activated' : 'deactivated'}!`)
        fetchPromoCodes()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update promo code')
      }
    } catch {
      setError('Failed to update promo code')
    }
  }

  const handleDelete = async (code: PromoCode) => {
    if (!confirm(`Are you sure you want to deactivate "${code.code}"?`)) return

    try {
      const response = await fetch(`/api/admin/promo-codes/${code.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSuccess(`Promo code "${code.code}" deactivated!`)
        fetchPromoCodes()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete promo code')
      }
    } catch {
      setError('Failed to delete promo code')
    }
  }

  const handleViewUsage = async (code: PromoCode) => {
    setShowUsageModal({ codeId: code.id, code: code.code })
    setUsageData(null)

    try {
      const response = await fetch(`/api/admin/promo-codes/${code.id}/usage`)
      if (response.ok) {
        const data = await response.json()
        setUsageData(data)
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/app/admin"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Admin
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">
                PROMO CODES
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Promo Code Management</h1>
            </div>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl">
              Create and manage discount codes for different domains.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Code
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckIcon className="h-5 w-5 text-green-600 mr-3" />
            <p className="text-green-800">{success}</p>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XMarkIcon className="h-5 w-5 text-red-600 mr-3" />
            <p className="text-red-800">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Domain Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Domain</label>
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
        >
          <option value="">All Domains</option>
          {availableDomains.map(domain => (
            <option key={domain} value={domain}>{domain}</option>
          ))}
        </select>
      </div>

      {/* Promo Codes Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applies To</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {promoCodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <TagIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No promo codes found. Create your first one!</p>
                </td>
              </tr>
            ) : (
              promoCodes.map((code) => (
                <tr key={code.id} className={!code.active ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <TagIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="font-mono font-bold text-gray-900">{code.code}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {code.domain}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-green-600">
                      {code.discountType === 'percentage'
                        ? `${code.discountValue}% off`
                        : `$${code.discountValue} off`
                      }
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {code.actualUsageCount} / {code.maxUses || '∞'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      code.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {code.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                    {code.applicableTo.join(', ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewUsage(code)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                        title="View Usage"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(code)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                        title={code.active ? 'Deactivate' : 'Activate'}
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(code)}
                        className="p-1.5 text-red-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Promo Code</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={newCode.code}
                  onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                  placeholder="FOUNDING50"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                <select
                  value={newCode.domain}
                  onChange={(e) => setNewCode({ ...newCode, domain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                >
                  {availableDomains.map(domain => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                  <select
                    value={newCode.discountType}
                    onChange={(e) => setNewCode({ ...newCode, discountType: e.target.value as 'percentage' | 'fixed_amount' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed_amount">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value {newCode.discountType === 'percentage' ? '(%)' : '($)'}
                  </label>
                  <input
                    type="number"
                    value={newCode.discountValue}
                    onChange={(e) => setNewCode({ ...newCode, discountValue: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max={newCode.discountType === 'percentage' ? 100 : undefined}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses (optional)</label>
                  <input
                    type="number"
                    value={newCode.maxUses || ''}
                    onChange={(e) => setNewCode({ ...newCode, maxUses: parseInt(e.target.value) || 0 })}
                    min="0"
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires (optional)</label>
                  <input
                    type="date"
                    value={newCode.validUntil}
                    onChange={(e) => setNewCode({ ...newCode, validUntil: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Applies To</label>
                <div className="flex gap-4">
                  {['plan', 'seats', 'top_up'].map(type => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newCode.applicableTo.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewCode({ ...newCode, applicableTo: [...newCode.applicableTo, type] })
                          } else {
                            setNewCode({ ...newCode, applicableTo: newCode.applicableTo.filter(t => t !== type) })
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCode}
                disabled={!newCode.code || !newCode.domain}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors disabled:opacity-50"
              >
                Create Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Modal */}
      {showUsageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                Usage History: <span className="font-mono">{showUsageModal.code}</span>
              </h2>
              <button
                onClick={() => setShowUsageModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              {!usageData ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : usageData.usages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No usage yet</div>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600 font-medium">Total Discount Given</p>
                      <p className="text-2xl font-bold text-green-700">
                        ${usageData.totals.totalDiscountGiven.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600 font-medium">Total Uses</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {usageData.totals.usageCount}
                      </p>
                    </div>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {usageData.usages.map(usage => (
                        <tr key={usage.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {usage.userName || usage.email || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 text-sm text-green-600 font-medium">
                            ${usage.discountAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(usage.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

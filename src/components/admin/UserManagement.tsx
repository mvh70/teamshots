'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { jsonFetcher } from '@/lib/fetcher'
import { PACKAGES_CONFIG } from '@/config/packages'
import { CLIENT_PACKAGES } from '@/domain/style/packages'
import {
  UserPlusIcon,
  XMarkIcon,
  ArrowUpCircleIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'

// Portal wrapper to render modals at document body level
function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}

interface CreditBreakdown {
  type: string
  credits: number
}

interface UserPackage {
  packageId: string
  purchasedAt: Date | null
}

interface UserData {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  signupDate: string
  planTier: string | null
  planPeriod: string | null
  totalCredits: number
  creditBreakdown: CreditBreakdown[]
  packages: UserPackage[]
  team?: {
    id: string
    name: string | null
    totalSeats: number
    activeSeats: number
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatPlan(planTier: string | null, planPeriod: string | null, team?: UserData['team']): string {
  if (!planTier && !planPeriod) return 'None'
  if (planPeriod === 'free') return `${planTier || 'individual'} (Free Trial)`
  if (planTier === 'pro' && planPeriod === 'seats' && team) {
    return `pro (${team.activeSeats}/${team.totalSeats} seats)`
  }
  return `${planTier || 'individual'} - ${planPeriod || 'free'}`
}

function PackageGrantModal({
  user,
  onClose,
  onSuccess
}: {
  user: UserData
  onClose: () => void
  onSuccess: () => void
}) {
  const [selectedPackage, setSelectedPackage] = useState('')
  const [isGranting, setIsGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only show packages that are actually registered in CLIENT_PACKAGES
  // Exclude 'freepackage' (runtime teaser for free users)
  const registeredPackages = Object.keys(CLIENT_PACKAGES).filter(
    p => p !== 'freepackage'
  )
  const userPackageIds = user.packages.map(p => p.packageId)
  const grantablePackages = registeredPackages.filter(p => !userPackageIds.includes(p))

  const handleGrant = async () => {
    if (!selectedPackage) return

    setIsGranting(true)
    setError(null)

    try {
      await jsonFetcher('/api/packages/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          packageId: selectedPackage
        })
      })

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant package')
    } finally {
      setIsGranting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="grant-package-title">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="grant-package-title" className="text-lg font-semibold text-gray-900">Grant Package</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Grant package to: <span className="font-medium">{user.email}</span>
          </p>
        </div>

        {grantablePackages.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-lg mb-4">
            <p className="text-sm text-gray-600">
              User already has all available packages.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label htmlFor="package-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Package
              </label>
              <select
                id="package-select"
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="">Choose a package...</option>
                {grantablePackages.map(pkgId => {
                  const pkg = CLIENT_PACKAGES[pkgId]
                  const pkgConfig = PACKAGES_CONFIG.active[pkgId as keyof typeof PACKAGES_CONFIG.active]
                  return (
                    <option key={pkgId} value={pkgId}>
                      {pkgConfig?.name || pkg?.label || pkgId}
                    </option>
                  )
                })}
              </select>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleGrant}
                disabled={!selectedPackage || isGranting}
                className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGranting ? 'Granting...' : 'Grant Package'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PlanUpgradeModal({
  user,
  onClose,
  onSuccess
}: {
  user: UserData
  onClose: () => void
  onSuccess: () => void
}) {
  const [planType, setPlanType] = useState<'individual' | 'vip' | 'team'>('individual')
  const [seats, setSeats] = useState(2)
  const [assignSeatToUser, setAssignSeatToUser] = useState(true)
  const [reason, setReason] = useState('')
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpgrade = async () => {
    setIsUpgrading(true)
    setError(null)

    try {
      const payload: {
        userId: string
        planTier: 'individual' | 'pro'
        planPeriod: 'small' | 'large' | 'seats'
        seats?: number
        assignSeatToUser?: boolean
        reason?: string
      } = {
        userId: user.id,
        planTier: planType === 'team' ? 'pro' : 'individual',
        planPeriod: planType === 'individual' ? 'small' : planType === 'vip' ? 'large' : 'seats',
        reason: reason || undefined
      }

      if (planType === 'team') {
        payload.seats = seats
        payload.assignSeatToUser = assignSeatToUser
      }

      await jsonFetcher('/api/admin/users/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade plan')
    } finally {
      setIsUpgrading(false)
    }
  }

  const getPlanDescription = () => {
    switch (planType) {
      case 'individual':
        return '40 credits (4 photos) - $19.99 value'
      case 'vip':
        return '250 credits (25 photos) - $199.99 value'
      case 'team':
        return `${seats * 100} credits (${seats * 10} photos) for team pool`
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="upgrade-plan-title">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="upgrade-plan-title" className="text-lg font-semibold text-gray-900">Upgrade Plan</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            User: <span className="font-medium">{user.email}</span>
          </p>
          <p className="text-sm text-gray-500">
            Current plan: {formatPlan(user.planTier, user.planPeriod, user.team)}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Plan
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="planType"
                value="individual"
                checked={planType === 'individual'}
                onChange={() => setPlanType('individual')}
                className="text-brand-primary"
              />
              <div>
                <div className="font-medium">Individual</div>
                <div className="text-sm text-gray-500">40 credits - $19.99 value</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="planType"
                value="vip"
                checked={planType === 'vip'}
                onChange={() => setPlanType('vip')}
                className="text-brand-primary"
              />
              <div>
                <div className="font-medium">VIP</div>
                <div className="text-sm text-gray-500">250 credits - $199.99 value</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="planType"
                value="team"
                checked={planType === 'team'}
                onChange={() => setPlanType('team')}
                className="text-brand-primary"
              />
              <div>
                <div className="font-medium">Team / Pro</div>
                <div className="text-sm text-gray-500">Seats-based with team pool</div>
              </div>
            </label>
          </div>
        </div>

        {planType === 'team' && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of seats
              </label>
              <input
                type="number"
                min={2}
                value={seats}
                onChange={(e) => setSeats(Math.max(2, parseInt(e.target.value) || 2))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
              />
              <p className="text-xs text-gray-500 mt-1">
                {seats} seats = {seats * 100} credits ({seats * 10} photos)
              </p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={assignSeatToUser}
                onChange={(e) => setAssignSeatToUser(e.target.checked)}
                className="rounded text-brand-primary"
              />
              <span className="text-sm text-gray-700">
                Assign one seat to user (100 credits)
              </span>
            </label>
            {assignSeatToUser && (
              <p className="text-xs text-gray-500 pl-6">
                User gets 100 credits immediately, {seats - 1} seats remain for team members
              </p>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason (optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Support escalation, partnership"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
          />
        </div>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Will grant:</strong> {getPlanDescription()}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUpgrading ? 'Upgrading...' : 'Upgrade Plan'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function GiveCreditsModal({
  user,
  onClose,
  onSuccess
}: {
  user: UserData
  onClose: () => void
  onSuccess: () => void
}) {
  const [credits, setCredits] = useState(10)
  const [description, setDescription] = useState('')
  const [isGranting, setIsGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGrant = async () => {
    if (credits <= 0) return

    setIsGranting(true)
    setError(null)

    try {
      await jsonFetcher('/api/admin/credits/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          credits,
          description: description || undefined,
          type: 'admin_grant',
          assignTo: 'individual'
        })
      })

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant credits')
    } finally {
      setIsGranting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="give-credits-title">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="give-credits-title" className="text-lg font-semibold text-gray-900">Give Credits</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            User: <span className="font-medium">{user.email}</span>
          </p>
          <p className="text-sm text-gray-500">
            Current balance: {user.totalCredits} credits
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credits to grant
          </label>
          <input
            type="number"
            min={1}
            value={credits}
            onChange={(e) => setCredits(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
          />
          <p className="text-xs text-gray-500 mt-1">
            {credits} credits = {Math.floor(credits / 10)} photos (10 credits per photo)
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Customer support compensation"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
          />
        </div>

        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            New balance will be: {user.totalCredits + credits} credits
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleGrant}
            disabled={credits <= 0 || isGranting}
            className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGranting ? 'Granting...' : 'Give Credits'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [upgradeUser, setUpgradeUser] = useState<UserData | null>(null)
  const [giveCreditsUser, setGiveCreditsUser] = useState<UserData | null>(null)
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await jsonFetcher<{ users: UserData[] }>('/api/admin/users')
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div role="status" aria-label="Loading users" className="animate-spin h-8 w-8 border-4 border-brand-primary border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        <p className="text-sm text-gray-600 mt-1">
          Total users: {users.length}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Signup Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Credits
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Seats
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Packages
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-gray-900">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.firstName || 'No name'}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(user.signupDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    {formatPlan(user.planTier, user.planPeriod, user.team)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="inline-block">
                    <button
                      type="button"
                      className="text-sm font-medium text-gray-900 cursor-help bg-transparent border-none p-0"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setHoveredUserId(user.id)
                        setTooltipPosition({
                          x: rect.left,
                          y: rect.top - 10
                        })
                      }}
                      onMouseLeave={() => {
                        setHoveredUserId(null)
                        setTooltipPosition(null)
                      }}
                      onFocus={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setHoveredUserId(user.id)
                        setTooltipPosition({
                          x: rect.left,
                          y: rect.top - 10
                        })
                      }}
                      onBlur={() => {
                        setHoveredUserId(null)
                        setTooltipPosition(null)
                      }}
                      aria-describedby={hoveredUserId === user.id ? `tooltip-${user.id}` : undefined}
                    >
                      {user.totalCredits}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.team ? (
                    <span className="font-medium">
                      {user.team.activeSeats}/{user.team.totalSeats}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {user.packages.map((pkg) => {
                      const pkgConfig = PACKAGES_CONFIG.active[pkg.packageId as keyof typeof PACKAGES_CONFIG.active]
                      return (
                        <span
                          key={pkg.packageId}
                          className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800"
                        >
                          {pkgConfig?.name || pkg.packageId}
                        </span>
                      )
                    })}
                    {user.packages.length === 0 && (
                      <span className="text-sm text-gray-400">No packages</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUpgradeUser(user)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Upgrade Plan"
                    >
                      <ArrowUpCircleIcon className="h-4 w-4" />
                      Upgrade
                    </button>
                    <button
                      onClick={() => setGiveCreditsUser(user)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 rounded-md transition-colors"
                      title="Give Credits"
                    >
                      <CurrencyDollarIcon className="h-4 w-4" />
                      Credits
                    </button>
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-brand-primary hover:bg-brand-primary-light rounded-md transition-colors"
                      title="Grant Package"
                    >
                      <UserPlusIcon className="h-4 w-4" />
                      Package
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip with credit breakdown */}
      {hoveredUserId && (() => {
        const user = users.find(u => u.id === hoveredUserId)
        if (!user || !user.creditBreakdown.length) return null

        return (
          <div
            id={`tooltip-${user.id}`}
            role="tooltip"
            style={{
              position: 'fixed',
              left: '300px',
              top: '150px',
              width: '250px',
              padding: '12px',
              backgroundColor: '#1f2937',
              color: 'white',
              fontSize: '13px',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>Credit Breakdown:</div>
            {user.creditBreakdown.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ textTransform: 'capitalize' }}>{item.type.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 500 }}>{item.credits}</span>
              </div>
            ))}
            <div style={{
              borderTop: '1px solid #4b5563',
              marginTop: '8px',
              paddingTop: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 600
            }}>
              <span>Total:</span>
              <span>{user.totalCredits}</span>
            </div>
          </div>
        )
      })()}

      {selectedUser && (
        <ModalPortal>
          <PackageGrantModal
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onSuccess={() => {
              fetchUsers()
              setSelectedUser(null)
            }}
          />
        </ModalPortal>
      )}

      {upgradeUser && (
        <ModalPortal>
          <PlanUpgradeModal
            user={upgradeUser}
            onClose={() => setUpgradeUser(null)}
            onSuccess={() => {
              fetchUsers()
              setUpgradeUser(null)
            }}
          />
        </ModalPortal>
      )}

      {giveCreditsUser && (
        <ModalPortal>
          <GiveCreditsModal
            user={giveCreditsUser}
            onClose={() => setGiveCreditsUser(null)}
            onSuccess={() => {
              fetchUsers()
              setGiveCreditsUser(null)
            }}
          />
        </ModalPortal>
      )}
    </div>
  )
}

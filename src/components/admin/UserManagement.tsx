'use client'

import React, { useState, useEffect } from 'react'
import { jsonFetcher } from '@/lib/fetcher'
import { PACKAGES_CONFIG } from '@/config/packages'
import { CLIENT_PACKAGES } from '@/domain/style/packages'
import { UserPlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

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
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatPlan(planTier: string | null, planPeriod: string | null): string {
  if (!planTier && !planPeriod) return 'None'
  if (planPeriod === 'free') return `${planTier || 'individual'} (Free Trial)`
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
  // Exclude 'tryitforfree' (special signup flow) and 'freepackage' (runtime teaser)
  const registeredPackages = Object.keys(CLIENT_PACKAGES).filter(
    p => p !== 'tryitforfree' && p !== 'freepackage'
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Grant Package</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Package
              </label>
              <select
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

export default function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
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
        <div className="animate-spin h-8 w-8 border-4 border-brand-primary border-t-transparent rounded-full"></div>
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
                    {formatPlan(user.planTier, user.planPeriod)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="inline-block">
                    <span
                      className="text-sm font-medium text-gray-900 cursor-help"
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
                    >
                      {user.totalCredits}
                    </span>
                  </div>
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
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-brand-primary-light rounded-md transition-colors"
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    Grant Package
                  </button>
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
        <PackageGrantModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSuccess={() => {
            fetchUsers()
            setSelectedUser(null)
          }}
        />
      )}
    </div>
  )
}

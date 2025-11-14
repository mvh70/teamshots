'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface InviteDashboardHeaderProps {
  title: string
  subtitle?: string
  right?: React.ReactNode
  showBackToDashboard?: boolean
  token: string
  memberName?: string
  memberEmail?: string
  teamName?: string
  creditsRemaining?: number
  photosAffordable?: number
  onBackClick?: () => void
}

export default function InviteDashboardHeader({
  title,
  subtitle,
  right,
  showBackToDashboard = false,
  token,
  memberName: memberNameProp,
  memberEmail: memberEmailProp,
  teamName: teamNameProp,
  creditsRemaining,
  photosAffordable,
  onBackClick
}: InviteDashboardHeaderProps) {
  const router = useRouter()
  
  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick()
    } else {
      router.push(`/invite-dashboard/${token}`)
    }
  }

  // Resolve member/team info: prefer props; otherwise fetch from invite token
  const [fetched, setFetched] = useState<{ memberName?: string; memberEmail?: string; teamName?: string } | null>(null)
  useEffect(() => {
    if (memberNameProp || memberEmailProp || teamNameProp) return
    let isMounted = true
    const run = async () => {
      try {
        const res = await fetch('/api/team/invites/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
        if (!res.ok) return
        const data = await res.json() as { invite?: { firstName?: string; lastName?: string; email?: string; teamName?: string } }
        if (!isMounted) return
        const first = data.invite?.firstName?.trim() || ''
        const last = data.invite?.lastName?.trim() || ''
        const name = [first, last].filter(Boolean).join(' ').trim() || undefined
        setFetched({
          memberName: name,
          memberEmail: data.invite?.email,
          teamName: data.invite?.teamName
        })
      } catch {
        // non-blocking
      }
    }
    void run()
    return () => { isMounted = false }
  }, [token, memberNameProp, memberEmailProp, teamNameProp])

  const memberName = memberNameProp ?? fetched?.memberName
  const memberEmail = memberEmailProp ?? fetched?.memberEmail
  const teamName = teamNameProp ?? fetched?.teamName

  const resolvedTitle = useMemo(() => {
    if (title) return title
    return teamName ? `You've joined ${teamName}` : "You've joined your team"
  }, [title, teamName])

  const resolvedSubtitle = useMemo(() => {
    if (subtitle) return subtitle
    return 'Upload your selfie and generate your professional team photo in under 60 seconds.'
  }, [subtitle])

  const showMemberInfo = Boolean(memberName || memberEmail)
  const showCredits = typeof creditsRemaining === 'number' && typeof photosAffordable === 'number'

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile: Reduced header with team name and back arrow or credits */}
        <div className="md:hidden flex items-center justify-between py-3">
          <div className="flex-1 min-w-0 pr-4">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {teamName || 'Team'}
            </h1>
          </div>
          {showBackToDashboard ? (
            <button
              onClick={handleBackClick}
              className="flex-shrink-0 p-2 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Back to dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : creditsRemaining !== undefined ? (
            <div className="flex-shrink-0 text-right">
              <p className="text-xs text-gray-500">Credits</p>
              <p className="text-xl font-bold text-brand-primary">{creditsRemaining}</p>
              {photosAffordable !== undefined && (
                <p className="text-xs text-gray-500 mt-1">
                  Good for {photosAffordable} photo{photosAffordable === 1 ? '' : 's'}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Desktop: Full header */}
        <div className="hidden md:flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            {showBackToDashboard && (
              <button
                onClick={handleBackClick}
                className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
            )}

            {showMemberInfo && (
              <p className="text-sm text-gray-500 mb-1 truncate">
                {memberName}
                {memberEmail ? ` (${memberEmail})` : ''}
              </p>
            )}

            {/* Team chip intentionally omitted per standard header design */}

            <h1 className="text-2xl font-bold text-gray-900 break-words">{resolvedTitle}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {resolvedSubtitle}
            </p>
          </div>

          {(right || showCredits) && (
            <div className="flex flex-col gap-3 md:items-end">
              {right}
              {showCredits && (
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">Available Credits</p>
                  <p className="text-2xl font-bold text-brand-primary">{creditsRemaining}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Good for {photosAffordable} photo{photosAffordable === 1 ? '' : 's'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { BeforeAfterSlider } from '@/components/onboarding/BeforeAfterSlider'

interface InviteData {
  email: string
  teamName: string
  creditsAllocated: number
  expiresAt: string
  hasActiveContext: boolean
  firstName: string
  inviterFirstName: string
}

export default function InvitePage() {
  const t = useTranslations('invite')
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Random before/after sample selection
  const samplePairs = [
    { before: '/samples/before-1.jpg', after: '/samples/after-1.png' },
    { before: '/samples/before-2.png', after: '/samples/after-2.png' },
    { before: '/samples/before-3.jpg', after: '/samples/after-3.png' },
  ]
  const randomSample = samplePairs[Math.floor(Math.random() * samplePairs.length)]

  // Mobile detection - intentional client-only pattern
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                           ('ontouchstart' in window) ||
                           (window.innerWidth <= 768 && window.innerHeight <= 1024)
      setIsMobile(isMobileDevice)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  const validateInvite = useCallback(async () => {
    try {
      const response = await fetch('/api/team/invites/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const data = await response.json()

      if (response.ok) {
        // If invite is already used (has personId), redirect to dashboard
        if (data.invite.personId) {
          router.push(`/invite-dashboard/${token}`)
          return
        }
        setInviteData(data.invite)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Failed to validate invite')
    } finally {
      setLoading(false)
    }
  }, [token, router])

  useEffect(() => {
    if (token) {
      validateInvite()
    }
  }, [token, validateInvite])

  const acceptInvite = async () => {
    setAccepting(true)
    try {
      const response = await fetch('/api/team/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Redirect to invite dashboard
        router.push(`/invite-dashboard/${token}`)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Failed to accept invite')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Validating invite...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Invalid Invite</h1>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!inviteData) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8 sm:py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-depth-md border border-gray-100 p-8 sm:p-10">
        <div className="text-center mb-10 sm:mb-8">
          <div className="inline-block mb-3">
            <span className="text-4xl">👋</span>
          </div>
          <h1 className="text-3xl sm:text-2xl font-bold text-gray-900 mb-3">Hi {inviteData.firstName}!</h1>
          <p className="text-lg sm:text-base text-gray-700 leading-relaxed mb-2">
            <span className="font-semibold text-brand-primary">{inviteData.inviterFirstName}</span> invited you to get professional headshots for <span className="font-semibold text-gray-900">{inviteData.teamName}</span>.
          </p>
          <p className="text-base sm:text-sm text-gray-600">
            No awkward poses required. Just your best self.
          </p>
        </div>

        <div className="mb-8 sm:mb-6">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl sm:rounded-xl p-6 sm:p-5 border border-gray-200/50">
            <h3 className="text-lg sm:text-base font-semibold text-gray-900 mb-4 sm:mb-3">What you&apos;ll get:</h3>
            <ul className="space-y-3 sm:space-y-2.5">
              <li className="flex items-start gap-3 sm:gap-2.5">
                <div className="mt-0.5 flex-shrink-0 w-6 h-6 sm:w-5 sm:h-5 bg-brand-secondary/10 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-brand-secondary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                </div>
                <span className="text-base sm:text-sm text-gray-700 leading-relaxed">{t('benefit1')}</span>
              </li>
              <li className="flex items-start gap-3 sm:gap-2.5">
                <div className="mt-0.5 flex-shrink-0 w-6 h-6 sm:w-5 sm:h-5 bg-brand-secondary/10 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-brand-secondary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                </div>
                <span className="text-base sm:text-sm text-gray-700 leading-relaxed">{t('benefit2')}</span>
              </li>
              <li className="flex items-start gap-3 sm:gap-2.5">
                <div className="mt-0.5 flex-shrink-0 w-6 h-6 sm:w-5 sm:h-5 bg-brand-secondary/10 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-brand-secondary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                </div>
                <span className="text-base sm:text-sm text-gray-700 leading-relaxed">{t('benefit3')}</span>
              </li>
            </ul>
          </div>
            </div>

        {/* Before/After Slider Showcase */}
        <div className="mt-8 sm:mt-6">
          <div className="bg-gradient-to-r from-brand-primary-light via-brand-secondary-light to-brand-cta-light rounded-2xl sm:rounded-xl p-6 sm:p-5 shadow-depth-sm">
            <h3 className="text-lg sm:text-base font-semibold text-gray-900 mb-4 sm:mb-3 text-center">See the transformation</h3>

            <BeforeAfterSlider
              beforeImage={randomSample.before}
              afterImage={randomSample.after}
              beforeLabel="Before"
              afterLabel="After"
              className="max-w-sm mx-auto"
            />
          </div>
        </div>

        {/* Spacer */}
        <div className="mt-8 sm:mt-6"></div>

        {isMobile ? (
        <button
          onClick={acceptInvite}
            disabled={accepting}
            className={`w-full py-4 px-6 rounded-xl text-lg font-semibold transition-all duration-200 shadow-md ${
              !accepting
                ? 'bg-brand-primary text-white hover:bg-brand-primary-hover hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
            {accepting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Accepting...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Accept Invite
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            )}
        </button>
        ) : (
          <div className="text-center">
            <div className="bg-blue-50/50 border border-blue-200/40 rounded-xl p-4">
              <div className="flex items-center justify-center gap-2 mb-1">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-blue-800">{t('mobileRequired')}</span>
              </div>
              <p className="text-xs text-blue-600">{t('mobileReason')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
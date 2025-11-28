'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { signIn, getSession } from 'next-auth/react'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import { AuthButton, InlineError } from '@/components/ui'
import FocusTrap from '@/components/auth/FocusTrap'
import { jsonFetcher } from '@/lib/fetcher'

type FlowType = 'normal' | 'guest' | 'loading'

export default function VerifyPage() {
  const t = useTranslations('auth.signup')
  const searchParams = useSearchParams()
  const router = useRouter()

  const [otpCode, setOtpCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [flowType, setFlowType] = useState<FlowType>('loading')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPlanTier, setGuestPlanTier] = useState<string | null>(null)
  const [showGuestWelcome, setShowGuestWelcome] = useState(false)

  const emailParam = searchParams.get('email') || ''
  const tier = searchParams.get('tier') || ''
  const checkoutSessionId = searchParams.get('checkout_session_id') || ''

  // Load pending signup fields from sessionStorage (lazy initializer)
  const [pending] = useState<{ email: string; firstName: string; password: string; userType: 'individual' | 'team' } | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.sessionStorage.getItem('teamshots.pendingSignup')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  // Determine the email to use
  const effectiveEmail = useMemo(() => {
    if (flowType === 'guest') return guestEmail
    return emailParam || pending?.email || ''
  }, [flowType, guestEmail, emailParam, pending?.email])

  // Info message derived from tier/flow and email
  const infoMessage = useMemo(() => {
    if (flowType === 'guest' && guestEmail) {
      const planKey = guestPlanTier === 'pro' ? 'planPro' : guestPlanTier === 'individual' ? 'planIndividual' : 'planGeneric'
      return t('info.guestCheckout', { plan: t(planKey), email: guestEmail })
    }
    const planKey = tier === 'pro' ? 'planPro' : tier === 'individual' ? 'planIndividual' : 'planGeneric'
    return t('info.checkoutSuccess', { plan: t(planKey), email: effectiveEmail })
  }, [flowType, guestEmail, guestPlanTier, tier, effectiveEmail, t])

  // Send OTP function (defined before effects that use it)
  const sendOtp = useCallback(async (targetEmail: string) => {
    if (!targetEmail) return

    // Check cooldown
    try {
      const lastSentAtStr = typeof window !== 'undefined' ? window.sessionStorage.getItem('teamshots.otpLastSentAt') : null
      const lastSentAt = lastSentAtStr ? parseInt(lastSentAtStr, 10) : 0
      const secondsSince = lastSentAt ? Math.floor((Date.now() - lastSentAt) / 1000) : Number.MAX_SAFE_INTEGER
      if (secondsSince < 60) {
        setResendCooldown(Math.max(60 - secondsSince, 1))
        return
      }
    } catch { /* ignore */ }

    try {
      const data = await jsonFetcher<{ throttled?: boolean; wait?: number; message?: string }>('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, locale: 'en' }),
      })
      const wait = data?.throttled && typeof data.wait === 'number' ? data.wait : 30
      setResendCooldown(wait)
      try { 
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('teamshots.otpLastSentAt', String(Date.now())) 
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  }, [])

  // Determine flow type and fetch guest email if needed
  useEffect(() => {
    const determineFlow = async () => {
      // If we have a checkout_session_id and no pending signup, it's a guest checkout
      if (checkoutSessionId && !pending) {
        try {
          console.log('[Verify] Fetching checkout email for session:', checkoutSessionId)
          const response = await fetch(`/api/auth/checkout-email?session_id=${encodeURIComponent(checkoutSessionId)}`)
          const data = await response.json()
          console.log('[Verify] Checkout email response:', { ok: response.ok, status: response.status, data })
          
          if (response.ok && data.data?.email) {
            const email = data.data.email
            setGuestEmail(email)
            setGuestPlanTier(data.data.planTier || null)
            setFlowType('guest')
            // Send OTP immediately when flow is determined
            sendOtp(email)
          } else {
            // Failed to get email from checkout session
            console.error('[Verify] Failed to get checkout email:', data)
            setError('guestCheckoutError')
            setFlowType('normal') // Fall back to normal flow
            // Send OTP for normal flow if we have an email (pending is null here)
            if (emailParam) sendOtp(emailParam)
          }
        } catch (err) {
          console.error('[Verify] Error fetching checkout email:', err)
          setError('guestCheckoutError')
          setFlowType('normal')
          // Send OTP for normal flow if we have an email (pending is null here)
          if (emailParam) sendOtp(emailParam)
        }
      } else {
        // Normal signup flow
        console.log('[Verify] Normal signup flow - pending:', !!pending, 'checkoutSessionId:', !!checkoutSessionId)
        setFlowType('normal')
        // Send OTP immediately when flow is determined
        const normalEmail = emailParam || pending?.email
        if (normalEmail) sendOtp(normalEmail)
      }
    }

    determineFlow()
  }, [checkoutSessionId, pending, emailParam, sendOtp])

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // Handle OTP verification for normal signup
  const handleNormalVerify = async () => {
    const payload = {
      email: pending?.email || emailParam,
      password: pending?.password || '',
      firstName: pending?.firstName || '',
      otpCode,
      userType: pending?.userType || (tier === 'pro' ? 'team' : 'individual'),
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const registerData = await res.json()

    if (!res.ok) {
      const errText = (registerData?.error as string) || ''
      if (errText.includes('OTP') || errText.toLowerCase().includes('expired')) {
        throw new Error('Invalid OTP')
      } else {
        throw new Error('An error occurred')
      }
    }

    if (!registerData.success) {
      throw new Error((registerData.error as string) || 'Registration failed')
    }

    // Clear temporary storage
    try { window.sessionStorage.removeItem('teamshots.pendingSignup') } catch { /* ignore */ }

    // Sign in with password
    const signInResult = await signIn('credentials', {
      email: payload.email,
      password: payload.password,
      redirect: false,
    })
    
    if (signInResult?.error) {
      router.push('/auth/signin')
      return
    }

    await navigateToDashboard()
  }

  // Handle OTP verification for guest checkout
  const handleGuestVerify = async () => {
    // For guest checkout, the user already exists (created by webhook)
    // We just need to verify the OTP and sign them in
    const payload = {
      email: guestEmail,
      otpCode,
      guestCheckout: true,
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    if (!res.ok) {
      const errText = (data?.error as string) || ''
      if (errText.includes('OTP') || errText.toLowerCase().includes('expired')) {
        throw new Error('Invalid OTP')
      } else {
        throw new Error('An error occurred')
      }
    }

    if (!data.success) {
      throw new Error((data.error as string) || 'Verification failed')
    }

    // Sign in using the token returned from the API
    if (!data.data?.signInToken) {
      throw new Error('Sign-in token not received')
    }

    const signInResult = await signIn('credentials', {
      email: guestEmail,
      signInToken: data.data.signInToken,
      redirect: false,
    })
    
    if (!signInResult?.ok || signInResult?.error) {
      // If token sign-in fails, redirect to sign-in page
      console.error('Guest sign-in failed:', signInResult?.error)
      router.push('/auth/signin?from=guest-checkout')
      return
    }

    // Wait for session to be established
    let session = null
    let attempts = 0
    const maxAttempts = 10
    while (!session && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 200))
      session = await getSession()
      attempts++
    }

    if (!session) {
      console.error('Session not established after sign-in')
      router.push('/auth/signin?from=guest-checkout')
      return
    }

    // Show welcome message now that sign-in is confirmed
    setShowGuestWelcome(true)

    // Brief delay to show welcome message
    await new Promise(resolve => setTimeout(resolve, 1500))
    await navigateToDashboard()
  }

  const navigateToDashboard = async () => {
    const session = await getSession()
    if (session?.user) {
      try {
        const response = await fetch('/api/user/initial-data')
        if (response.ok) {
          const data = await response.json()
          // Store initial data in sessionStorage for components to use
          try {
            const dataWithTimestamp = { ...data, _timestamp: Date.now() }
            window.sessionStorage.setItem('teamshots.initialData', JSON.stringify(dataWithTimestamp))
          } catch { /* ignore */ }
          
          // Redirect based on onboarding state
          if (data.onboarding?.needsTeamSetup) {
            router.push('/app/team')
          } else {
            router.push('/app/dashboard')
          }
          return
        }
      } catch { /* ignore */ }
    }
    router.push('/app/dashboard')
  }

  const handleVerify = async () => {
    setIsLoading(true)
    setError('')
    try {
      if (flowType === 'guest') {
        await handleGuestVerify()
      } else {
        await handleNormalVerify()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    const targetEmail = flowType === 'guest' ? guestEmail : (emailParam || pending?.email || '')
    if (!targetEmail) return
    
    setIsLoading(true)
    try {
      const data = await jsonFetcher<{ throttled?: boolean; wait?: number }>(
        '/api/auth/otp/send',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail, locale: 'en' }),
        }
      )
      const wait = data?.throttled && data.wait ? data.wait : 30
      setResendCooldown(wait)
      try { 
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('teamshots.otpLastSentAt', String(Date.now())) 
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ }
    finally {
      setIsLoading(false)
    }
  }

  // Show loading state while determining flow
  if (flowType === 'loading') {
    return (
      <AuthSplitLayout
        left={
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-light via-white to-brand-cta-light rounded-2xl" />
            <div className="relative p-10">
              <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t('welcome')}</h1>
              <p className="text-gray-700 mb-8 text-lg">{t('welcomeSubtitle')}</p>
            </div>
          </div>
        }
      >
        <AuthCard title={t('title')}>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
          </div>
        </AuthCard>
      </AuthSplitLayout>
    )
  }

  // Show guest welcome message before redirect
  if (showGuestWelcome) {
    return (
      <AuthSplitLayout
        left={
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-100 via-white to-emerald-100 rounded-2xl" />
            <div className="relative p-10">
              <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t('guestWelcome.title')}</h1>
              <p className="text-gray-700 mb-8 text-lg">{t('guestWelcome.subtitle')}</p>
            </div>
          </div>
        }
      >
        <AuthCard title={t('guestWelcome.cardTitle')}>
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="text-gray-600">{t('guestWelcome.description')}</p>
            <p className="text-sm text-gray-500">{t('guestWelcome.redirecting')}</p>
          </div>
        </AuthCard>
      </AuthSplitLayout>
    )
  }

  return (
    <AuthSplitLayout
      left={
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-light via-white to-brand-cta-light rounded-2xl" />
          <div className="relative p-10">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t('welcome')}</h1>
            <p className="text-gray-700 mb-8 text-lg">{t('welcomeSubtitle')}</p>
          </div>
        </div>
      }
    >
      <AuthCard title={t('title')}>
        <FocusTrap>
          <div className="space-y-6">
            {infoMessage && (
              <div className="relative overflow-hidden rounded-2xl border border-brand-secondary-lighter bg-gradient-to-br from-brand-secondary-light via-white to-brand-secondary-lighter p-5 shadow-lg">
                {/* decorative confetti */}
                <div className="pointer-events-none absolute -top-3 -left-3 h-16 w-16 rounded-full bg-brand-secondary/20 blur-xl" />
                <div className="pointer-events-none absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-brand-secondary-border/20 blur-xl" />
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary text-white shadow-md">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l3-3z" clipRule="evenodd"/></svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-extrabold text-brand-secondary-text-light">{t('bannerTitle')}</div>
                    <p className="mt-1 text-sm text-brand-secondary-text-light/80">{infoMessage}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{t('didntReceiveCode')}</span>
              <button
                type="button"
                disabled={resendCooldown > 0 || isLoading}
                onClick={handleResendOtp}
                className={`font-semibold ${resendCooldown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-brand-primary hover:text-brand-primary-hover'}`}
              >
                {resendCooldown > 0 ? t('resendIn', { seconds: resendCooldown }) : t('resendCode')}
              </button>
            </div>
            <AuthInput
              id="otpCode"
              name="otpCode"
              type="text"
              maxLength={6}
              required
              label={t('verificationCodeLabel')}
              hint={t('enterCodeFor', { email: effectiveEmail })}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />
            <AuthButton
              type="button"
              onClick={handleVerify}
              loading={isLoading}
              disabled={isLoading || otpCode.length !== 6}
            >
              {isLoading ? t('verifying') : t('verifyCode')}
            </AuthButton>
            {error && <InlineError message={t(error) || error} className="text-center" />}
          </div>
        </FocusTrap>
      </AuthCard>
    </AuthSplitLayout>
  )
}

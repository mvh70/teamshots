'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'
import {useTranslations, useLocale} from 'next-intl'
import { ShieldCheckIcon, ClockIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { jsonFetcher } from '@/lib/fetcher'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import { AuthButton, InlineError } from '@/components/ui'
import FocusTrap from '@/components/auth/FocusTrap'
import { TEAM_DOMAIN, INDIVIDUAL_DOMAIN, COUPLES_DOMAIN, FAMILY_DOMAIN, EXTENSION_DOMAIN } from '@/config/domain'
import { PRICING_CONFIG } from '@/config/pricing'
import { trackSignupStarted, trackSignupCompleted } from '@/lib/track'

export default function SignUpPage() {
  const t = useTranslations('auth.signup')
  const tTrust = useTranslations('trustBadges')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [infoMessage] = useState('')

  const router = useRouter()

  // Determine brand name and free photo count based on current domain
  const getBrandInfo = () => {
    if (typeof window === 'undefined') {
      return {
        brandName: 'TeamShotsPro',
        photoCount: Math.floor(PRICING_CONFIG.freeTrial.pro / PRICING_CONFIG.credits.perGeneration)
      }
    }
    const hostname = window.location.hostname.replace(/^www\./, '')
    
    if (hostname === INDIVIDUAL_DOMAIN) {
      return {
        brandName: 'HeadshotOne',
        photoCount: Math.floor(PRICING_CONFIG.freeTrial.individual / PRICING_CONFIG.credits.perGeneration)
      }
    }
    if (hostname === COUPLES_DOMAIN) {
      return {
        brandName: 'DuoSnaps',
        photoCount: Math.floor(PRICING_CONFIG.freeTrial.individual / PRICING_CONFIG.credits.perGeneration)
      }
    }
    if (hostname === FAMILY_DOMAIN) {
      return {
        brandName: 'KinFrame',
        photoCount: Math.floor(PRICING_CONFIG.freeTrial.individual / PRICING_CONFIG.credits.perGeneration)
      }
    }
    if (hostname === EXTENSION_DOMAIN) {
      return {
        brandName: 'RightClickFit',
        photoCount: Math.floor(PRICING_CONFIG.freeTrial.individual / PRICING_CONFIG.credits.perGeneration)
      }
    }

    return {
      brandName: 'TeamShotsPro',
      photoCount: Math.floor(PRICING_CONFIG.freeTrial.pro / PRICING_CONFIG.credits.perGeneration)
    }
  }

  // URL params for checkout flow
  const planParam = searchParams.get('plan')
  const periodParam = searchParams.get('period')
  const autoCheckout = searchParams.get('autoCheckout') === 'true'

  // Form state - userType is determined server-side based on domain
  const [formData, setFormData] = useState(() => ({
    email: searchParams.get('email') || '',
    password: '',
    confirmPassword: '',
    firstName: '',
    otpCode: '',
  }))

  // Email validation state
  // Basic format check - server-side validation is more thorough
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)

  // Password validation state
  // SECURITY: Must match server-side validation in src/lib/validation.ts (8 chars min)
  const passwordMeetsRequirements = formData.password.length >= 8
  const passwordsMatch = formData.password === formData.confirmPassword
  const confirmPasswordTouched = formData.confirmPassword.length > 0

  // Track signup page view
  useEffect(() => {
    trackSignupStarted('email')
  }, [])

  const handleSendOTP = async () => {
    setIsLoading(true)
    setError('')

    try {
      const data = await jsonFetcher<{ success?: boolean; error?: string }>('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      })

      if (data.success) {
        setStep(2)
        // start cooldown (30s) to prevent spamming resend
        setResendCooldown(30)
        const timer = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        setError(data.error || 'Failed to send OTP')
      }
    } catch {
      setError('errorOccurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubscribe = async () => {
    // New flow: send OTP and proceed to verification step; no checkout here
    await handleSendOTP()
  }

  const handleVerifyOTP = async () => {
    setIsLoading(true)
    setError('')

    try {
      // Register directly; server determines userType from domain
      const registerData = await jsonFetcher<{ success?: boolean; error?: string }>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          otpCode: formData.otpCode,
          period: periodParam || undefined,
        }),
      })
      if (registerData.success) {
        const signInResult = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        })
        if (signInResult?.error) {
          router.push('/auth/signin')
        } else {
          // Fetch all initial data in one consolidated call
          const session = await getSession()

          // Track signup completed
          if (session?.user?.id) {
            trackSignupCompleted(session.user.id, 'email')
          }
          if (session?.user) {
            try {
              const response = await fetch('/api/user/initial-data')
              if (response.ok) {
                const data = await response.json()
                // Store initial data in sessionStorage for components to use
                try {
                  // Add timestamp so components can check data freshness
                  const dataWithTimestamp = { ...data, _timestamp: Date.now() }
                  window.sessionStorage.setItem('teamshots.initialData', JSON.stringify(dataWithTimestamp))
                } catch {}
                
                // Redirect based on onboarding state or checkout intent
                if (autoCheckout && planParam && periodParam) {
                  router.push(`/${locale}/app/upgrade?autoCheckout=true&plan=${planParam}&period=${periodParam}`)
                } else if (data.onboarding?.needsTeamSetup) {
                  router.push('/app/team')
                } else {
                  router.push('/app/dashboard')
                }
              } else {
                router.push('/app/dashboard')
              }
            } catch {
              router.push('/app/dashboard')
            }
          } else {
            router.push('/app/dashboard')
          }
        }
      } else {
        if (registerData.error === 'Invalid or expired OTP') {
          await handleSendOTP()
          setError('auth.signup.newCodeSent')
        } else if (registerData.error === 'User already exists') {
          // SECURITY: Don't attempt sign-in with entered password
          // Just redirect to signin page to prevent password verification leaks
          router.push('/auth/signin?email=' + encodeURIComponent(formData.email))
        } else {
          setError(registerData.error || 'Registration failed')
        }
      }
    } catch {
      setError('errorOccurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthSplitLayout
      left={
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 rounded-3xl shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-500 group-hover:shadow-2xl group-hover:from-blue-500/15 group-hover:via-purple-500/8 group-hover:to-pink-500/15" />
          <div className="relative p-12 lg:p-14">
            <h1 className="text-5xl lg:text-6xl font-display font-bold text-slate-900 mb-6 tracking-tight leading-tight bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">{t('welcome')}</h1>
            <p className="text-xl lg:text-2xl text-slate-600 mb-12 leading-relaxed font-medium">{t('welcomeSubtitle')}</p>
            <div className="space-y-6">
              <div className="flex items-center gap-4 transform transition-all duration-200 hover:translate-x-1">
                <span className="w-3 h-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full shadow-sm animate-pulse" style={{ animationDuration: '2s' }} />
                <span className="text-lg lg:text-xl text-slate-700 font-medium">{t('benefit1')}</span>
              </div>
              <div className="flex items-center gap-4 transform transition-all duration-200 hover:translate-x-1" style={{ transitionDelay: '50ms' }}>
                <span className="w-3 h-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-sm animate-pulse" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                <span className="text-lg lg:text-xl text-slate-700 font-medium">{t('benefit2')}</span>
              </div>
              <div className="flex items-center gap-4 transform transition-all duration-200 hover:translate-x-1" style={{ transitionDelay: '100ms' }}>
                <span className="w-3 h-3 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full shadow-sm animate-pulse" style={{ animationDuration: '2s', animationDelay: '1s' }} />
                <span className="text-lg lg:text-xl text-slate-700 font-medium">{t('benefit3')}</span>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-3 mt-8 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                <ShieldCheckIcon className="w-4 h-4 text-green-600" />
                <span className="font-medium">{tTrust('stripeSecure')}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                <ClockIcon className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{tTrust('instantResults')}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{tTrust('moneyBack')}</span>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <AuthCard
        title={t('title')}
        subtitle={
          <div>
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-5 py-2.5 rounded-lg text-xs lg:text-sm font-bold shadow-md border border-green-200/50 transform transition-all duration-200 hover:scale-105 hover:shadow-lg">
                {t('freeBadge', getBrandInfo())}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <div className={`h-2.5 w-28 rounded-full transition-all duration-300 ${step === 1 ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-md' : 'bg-slate-200'}`} />
              <div className={`h-2.5 w-28 rounded-full transition-all duration-300 ${step === 2 ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-md' : 'bg-slate-200'}`} />
            </div>
            <p className="mt-3 text-sm lg:text-base text-slate-600 font-medium">{t('stepOf', { step: String(step) })}</p>
          </div>
        }
      >
        <FocusTrap>
        <div className="space-y-7 lg:space-y-8">
          {step === 1 && (
            <>
              {/* Google Sign-Up Button */}
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => signIn('google', { callbackUrl: autoCheckout && planParam && periodParam
                    ? `/${locale}/app/upgrade?autoCheckout=true&plan=${planParam}&period=${periodParam}`
                    : '/app/dashboard'
                  })}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {t('signUpWithGoogle')}
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-slate-500 font-medium">{t('orContinueWith')}</span>
                </div>
              </div>

              <AuthInput
                id="firstName"
                name="firstName"
                type="text"
                required
                label={t('firstNameLabel')}
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
              <AuthInput
                id="email"
                name="email"
                type="email"
                required
                label={t('emailLabel')}
                placeholder={t('emailPlaceholder')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              
              {/* Passwords */}
              <div>
                <AuthInput
                  id="password"
                  name="password"
                  type="password"
                  required
                  label={
                    <span className="flex items-center gap-2">
                      <span>{t('passwordLabel')}</span>
                      {passwordMeetsRequirements && (
                        <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  }
                  placeholder={t('passwordRequirement')}
                  strengthMeter
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div>
                <AuthInput
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  label={t('confirmPasswordLabel')}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
                {confirmPasswordTouched && !passwordsMatch && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {t('passwordsDoNotMatch')}
                  </div>
                )}
              </div>
              <AuthButton
                type="button"
                onClick={handleSubscribe}
                loading={isLoading}
                disabled={isLoading || !isValidEmail || !formData.firstName || !passwordMeetsRequirements || !passwordsMatch}
              >
                {isLoading ? t('sending') : t('sendCode')}
              </AuthButton>
            </>
          )}

          {step === 2 && (
            <>
              {infoMessage && (
                <div className="text-sm lg:text-base text-slate-700 bg-blue-50/50 border-2 border-blue-200 rounded-xl p-5 text-center mb-2 shadow-sm">
                  {infoMessage}
                </div>
              )}
              <AuthInput
                id="otpCode"
                name="otpCode"
                type="text"
                maxLength={6}
                required
                label={t('enterCodeFor', { email: formData.email })}
                value={formData.otpCode}
                onChange={(e) => setFormData({ ...formData, otpCode: e.target.value })}
              />
              <div className="flex items-center justify-between text-sm lg:text-base pt-1">
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-all duration-200 font-semibold hover:underline underline-offset-2 decoration-2"
                  onClick={handleSendOTP}
                  disabled={resendCooldown > 0 || isLoading}
                >
                  {resendCooldown > 0 ? t('resendIn', { seconds: String(resendCooldown) }) : t('resendCode')}
                </button>
                <span className="text-slate-500 font-medium">{t('otpHelp')}</span>
              </div>
              {error === 'auth.signup.newCodeSent' && (
                <div className="text-green-600 text-sm text-center font-medium bg-green-50 py-2 rounded-lg">{t('newCodeSent')}</div>
              )}
              <AuthButton
                type="button"
                onClick={handleVerifyOTP}
                loading={isLoading}
                disabled={isLoading || formData.otpCode.length !== 6}
              >
                {isLoading ? t('verifying') : t('verifyCode')}
              </AuthButton>
            </>
          )}

          {error && error !== 'auth.signup.newCodeSent' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <InlineError message={t(error)} className="text-center bg-red-50/50 py-3 px-4 rounded-lg border border-red-200" />
            </div>
          )}

          <div className="text-center pt-3">
            <Link href="/auth/signin" className="text-sm lg:text-base font-semibold text-blue-600 hover:text-blue-700 transition-all duration-200 hover:underline underline-offset-4 decoration-2">
              {t('haveAccount')}
            </Link>
          </div>
        </div>
        </FocusTrap>

      </AuthCard>
    </AuthSplitLayout>
  )
}

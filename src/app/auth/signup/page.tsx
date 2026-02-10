'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signOut, getSession } from 'next-auth/react'
import {useTranslations, useLocale} from 'next-intl'
import { ShieldCheckIcon, ClockIcon, BanknotesIcon, SparklesIcon, CameraIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { jsonFetcher } from '@/lib/fetcher'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import PasswordFields, { usePasswordValidation } from '@/components/auth/PasswordFields'
import { AuthButton, InlineError } from '@/components/ui'
import FocusTrap from '@/components/auth/FocusTrap'
import { getClientBrandInfo } from '@/config/domain'
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

  // Keep OAuth start and callback on the same host to preserve PKCE cookies.
  useEffect(() => {
    const canonicalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
    if (!canonicalBaseUrl) return
    try {
      const canonical = new URL(canonicalBaseUrl)
      if (window.location.hostname !== canonical.hostname) {
        const target = `${canonical.protocol}//${canonical.host}${window.location.pathname}${window.location.search}${window.location.hash}`
        window.location.replace(target)
      }
    } catch {
      // Ignore invalid canonical URL config
    }
  }, [])

  // Determine brand name and free photo count based on current domain
  const getBrandInfo = () => {
    const { brandName, isIndividual } = getClientBrandInfo()
    const credits = isIndividual ? PRICING_CONFIG.freeTrial.individual : PRICING_CONFIG.freeTrial.pro
    return {
      brandName,
      photoCount: Math.floor(credits / PRICING_CONFIG.credits.perGeneration)
    }
  }

  // URL params for checkout flow
  const planParam = searchParams.get('plan')
  const periodParam = searchParams.get('period')
  const autoCheckout = searchParams.get('autoCheckout') === 'true'

  const getGoogleCallbackPath = () => (
    autoCheckout && planParam && periodParam
      ? `/${locale}/app/upgrade?autoCheckout=true&plan=${planParam}&period=${periodParam}&newSignup=google`
      : '/app/dashboard?newSignup=google'
  )

  const handleGoogleSignUp = async () => {
    trackSignupStarted('google')
    const callbackUrl = getGoogleCallbackPath()
    try {
      // Important: Auth.js links OAuth accounts to the currently signed-in user.
      // Sign out first so Google sign-up uses the selected account, not the existing session.
      await signOut({ redirect: false })
    } catch {
      // Continue to Google sign-up even if local sign-out fails.
    }
    await signIn('google', { callbackUrl }, { prompt: 'select_account' })
  }

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
  const { passwordMeetsRequirements, passwordsMatch, isValid: passwordIsValid } = usePasswordValidation(
    formData.password,
    formData.confirmPassword
  )
  const confirmPasswordTouched = formData.confirmPassword.length > 0

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
    trackSignupStarted('email')
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
                } else if (data.onboarding?.needsTeamSetup && !isIndividual) {
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

  const { isIndividual } = getClientBrandInfo()

  // Portreya left panel - Precision Studio design
  const photoShotsProLeft = (
    <div className="relative">
      {/* Viewfinder frame decoration */}
      <div className="absolute -top-4 -left-4 w-8 h-8 border-l-2 border-t-2 border-[#B45309]/40" />
      <div className="absolute -top-4 -right-4 w-8 h-8 border-r-2 border-t-2 border-[#B45309]/40" />
      <div className="absolute -bottom-4 -left-4 w-8 h-8 border-l-2 border-b-2 border-[#B45309]/40" />
      <div className="absolute -bottom-4 -right-4 w-8 h-8 border-r-2 border-b-2 border-[#B45309]/40" />

      <div className="relative p-8 lg:p-12 border border-[#0F172A]/10 bg-[#F5F0E8]/50">
        {/* Camera info bar */}
        <div className="flex items-center justify-between mb-8 text-[#0F172A]/40 text-xs tracking-widest uppercase">
          <span>ISO 400</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B45309] animate-pulse" />
            REC
          </span>
          <span>f/2.8</span>
        </div>

        <h1 className="font-serif text-4xl lg:text-5xl text-[#0F172A] mb-6 leading-tight">
          Create Your
          <span className="block text-[#B45309]">Professional Image</span>
        </h1>

        <p className="text-lg text-[#0F172A]/70 mb-10 leading-relaxed">
          Join thousands of professionals who transformed their online presence with AI-generated headshots.
        </p>

        {/* Benefits */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 group">
            <div className="w-10 h-10 flex items-center justify-center border border-[#B45309]/20 text-[#B45309]">
              <CameraIcon className="w-5 h-5" />
            </div>
            <span className="text-[#0F172A]/80 font-medium">{t('benefit1')}</span>
          </div>
          <div className="flex items-center gap-4 group">
            <div className="w-10 h-10 flex items-center justify-center border border-[#B45309]/20 text-[#B45309]">
              <ClockIcon className="w-5 h-5" />
            </div>
            <span className="text-[#0F172A]/80 font-medium">{t('benefit2')}</span>
          </div>
          <div className="flex items-center gap-4 group">
            <div className="w-10 h-10 flex items-center justify-center border border-[#B45309]/20 text-[#B45309]">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <span className="text-[#0F172A]/80 font-medium">{t('benefit3Individual')}</span>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center gap-3 mt-10 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-[#0F172A]/10 text-[#0F172A]/60">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-[#B45309]" />
            <span className="font-medium">{tTrust('stripeSecure')}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-[#0F172A]/10 text-[#0F172A]/60">
            <ClockIcon className="w-3.5 h-3.5 text-[#B45309]" />
            <span className="font-medium">{tTrust('instantResults')}</span>
          </div>
        </div>
      </div>
    </div>
  )

  // TeamShotsPro left panel - Original design
  const teamShotsProLeft = (
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
  )

  return (
    <AuthSplitLayout
      left={isIndividual ? photoShotsProLeft : teamShotsProLeft}
    >
      <AuthCard
        title={t('title')}
        subtitle={
          <div>
            <div className="flex justify-center mb-4">
              <span className={`inline-flex items-center px-5 py-2.5 text-xs lg:text-sm font-bold shadow-md transform transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                isIndividual
                  ? 'bg-[#B45309]/10 text-[#B45309] border border-[#B45309]/20'
                  : 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-lg border border-green-200/50'
              }`}>
                {t('freeBadge', getBrandInfo())}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <div className={`h-2.5 w-28 transition-all duration-300 ${
                isIndividual ? 'rounded-sm' : 'rounded-full'
              } ${step === 1
                ? (isIndividual ? 'bg-[#B45309] shadow-md' : 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-md')
                : 'bg-slate-200'
              }`} />
              <div className={`h-2.5 w-28 transition-all duration-300 ${
                isIndividual ? 'rounded-sm' : 'rounded-full'
              } ${step === 2
                ? (isIndividual ? 'bg-[#B45309] shadow-md' : 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-md')
                : 'bg-slate-200'
              }`} />
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
                  onClick={handleGoogleSignUp}
                  className={`w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
                    isIndividual
                      ? 'border-[#0F172A]/10 text-[#0F172A] hover:border-[#0F172A]/20 hover:bg-[#FAFAF9]'
                      : 'border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
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
                  className={`disabled:opacity-50 transition-all duration-200 font-semibold hover:underline underline-offset-2 decoration-2 ${
                    isIndividual ? 'text-[#B45309] hover:text-[#92400E]' : 'text-blue-600 hover:text-blue-700'
                  }`}
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
            <Link href="/auth/signin" className={`text-sm lg:text-base font-semibold transition-all duration-200 hover:underline underline-offset-4 decoration-2 ${
              isIndividual ? 'text-[#B45309] hover:text-[#92400E]' : 'text-blue-600 hover:text-blue-700'
            }`}>
              {t('haveAccount')}
            </Link>
          </div>
        </div>
        </FocusTrap>

      </AuthCard>
    </AuthSplitLayout>
  )
}

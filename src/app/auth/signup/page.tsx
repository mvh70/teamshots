'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'
import {useTranslations, useLocale} from 'next-intl'
import Link from 'next/link'
import { jsonFetcher } from '@/lib/fetcher'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import { AuthButton, InlineError } from '@/components/ui'
import FocusTrap from '@/components/auth/FocusTrap'

export default function SignUpPage() {
  const t = useTranslations('auth.signup')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [infoMessage] = useState('')

  const router = useRouter()

  // URL params for checkout flow
  const planParam = searchParams.get('plan')
  const periodParam = searchParams.get('period')
  const autoCheckout = searchParams.get('autoCheckout') === 'true'
  const isTryItForFree = periodParam === 'tryItForFree'

  // Form state - userType is determined server-side based on domain
  const [formData, setFormData] = useState(() => ({
    email: searchParams.get('email') || '',
    password: '',
    confirmPassword: '',
    firstName: '',
    otpCode: '',
  }))

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
      setError('An error occurred')
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
          period: isTryItForFree ? 'tryItForFree' : undefined,
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
      setError('An error occurred')
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
          </div>
        </div>
      }
    >
      <AuthCard
        title={t('title')}
        subtitle={
          <div>
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-5 py-2.5 rounded-full text-xs lg:text-sm font-bold shadow-md border border-green-200/50 transform transition-all duration-200 hover:scale-105 hover:shadow-lg">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2.5 animate-pulse"></span>
                {t('freeBadge', { default: 'Includes 1 free generation' })}
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
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              
              {/* Passwords */}
              <AuthInput
                id="password"
                name="password"
                type="password"
                required
                label={t('passwordLabel')}
                strengthMeter
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <AuthInput
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                label={t('confirmPasswordLabel')}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
              <AuthButton
                type="button"
                onClick={handleSubscribe}
                loading={isLoading}
                disabled={isLoading || !formData.email || !formData.password || formData.password !== formData.confirmPassword || !formData.firstName}
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
                label={t('verificationCodeLabel')}
                hint={t('enterCodeFor', { email: formData.email })}
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import { jsonFetcher } from '@/lib/fetcher'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import { AuthButton, InlineError } from '@/components/ui'
import FocusTrap from '@/components/auth/FocusTrap'
import { PlanSelection } from '@/components/auth/PlanSelection'
import { getClientDomain, getSignupTypeFromDomain, getForcedSignupType } from '@/lib/domain'

export default function SignUpPage() {
  const t = useTranslations('auth.signup')
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    otpCode: '',
    userType: 'individual' as 'individual' | 'team',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [infoMessage] = useState('')

  // Domain-based signup restriction
  const [domainRestrictedUserType, setDomainRestrictedUserType] = useState<'individual' | 'team' | null>(null)

  const router = useRouter()
  
  // Derived: infer plan from URL params
  const tierParam = searchParams.get('tier') as 'individual' | 'team' | null
  const periodParam = (searchParams.get('period') || 'monthly') as 'monthly' | 'annual' | 'try_once'
  const isTryOnce = periodParam === 'try_once'
  const inferredTier: 'individual' | 'team' | null = tierParam ? tierParam : null

  // Handle URL parameters to pre-select options and post-checkout OTP step
  useEffect(() => {
    if (inferredTier) {
      setFormData(prev => ({ ...prev, userType: inferredTier }))
    }
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setFormData(prev => ({ ...prev, email: emailParam }))
    }
  }, [inferredTier, isTryOnce, searchParams])

  // Domain-based signup restriction: auto-detect domain and restrict userType
  useEffect(() => {
    const domain = getClientDomain()
    const forcedType = getForcedSignupType()
    const restrictedType = forcedType || getSignupTypeFromDomain(domain)

    if (restrictedType) {
      setDomainRestrictedUserType(restrictedType)
      setFormData(prev => ({ ...prev, userType: restrictedType }))
    } else {
      setDomainRestrictedUserType(null)
    }
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
      // Register directly; server will validate OTP (single verification)
      const registerData = await jsonFetcher<{ success?: boolean; error?: string }>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          otpCode: formData.otpCode,
          userType: formData.userType,
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
                
                // Redirect based on onboarding state
                if (data.onboarding?.needsTeamSetup) {
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
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-light via-bg-white to-brand-cta-light rounded-3xl shadow-depth-lg" />
          <div className="relative p-10 lg:p-12">
            <h1 className="text-4xl lg:text-5xl font-display font-bold text-text-dark mb-6">{t('welcome')}</h1>
            <p className="text-lg lg:text-xl text-text-body mb-10 leading-relaxed">{t('welcomeSubtitle')}</p>
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 bg-brand-cta rounded-full" />
                <span className="text-base lg:text-lg text-text-body">{t('benefit1')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 bg-brand-cta rounded-full" />
                <span className="text-base lg:text-lg text-text-body">{t('benefit2')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 bg-brand-cta rounded-full" />
                <span className="text-base lg:text-lg text-text-body">{t('benefit3')}</span>
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
            <div className="flex justify-center mb-3">
              <span className="inline-flex items-center bg-brand-secondary/10 text-brand-secondary px-4 py-2 rounded-full text-xs lg:text-sm font-bold shadow-depth-sm">
                <span className="w-2 h-2 bg-brand-secondary rounded-full mr-2 animate-pulse"></span>
                {t('freeBadge', { default: 'Includes 1 free generation' })}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className={`h-2 w-24 rounded-full transition-all duration-300 ${step === 1 ? 'bg-brand-primary shadow-depth-sm' : 'bg-brand-primary-lighter'}`} />
              <div className={`h-2 w-24 rounded-full transition-all duration-300 ${step === 2 ? 'bg-brand-primary shadow-depth-sm' : 'bg-brand-primary-lighter'}`} />
            </div>
            <p className="mt-3 text-sm lg:text-base text-text-body">{t('stepOf', { step: String(step) })}</p>
          </div>
        }
      >
        <FocusTrap>
        <div className="space-y-6 lg:space-y-7">
          {step === 1 && (
            <>
              {/* Plan selection - only show when no domain restriction */}
              {!domainRestrictedUserType && !inferredTier && !isTryOnce && (
                <PlanSelection
                  selectedPlan={formData.userType}
                  onPlanSelect={(plan) => setFormData({ ...formData, userType: plan })}
                />
              )}

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
                <div className="text-sm lg:text-base text-text-body bg-bg-gray-50 border-2 border-brand-primary-lighter rounded-xl p-4 text-center mb-2 shadow-depth-sm">
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
              <div className="flex items-center justify-between text-sm lg:text-base">
                <button
                  type="button"
                  className="text-brand-primary hover:text-brand-primary-hover disabled:opacity-50 transition-colors duration-300 font-medium"
                  onClick={handleSendOTP}
                  disabled={resendCooldown > 0 || isLoading}
                >
                  {resendCooldown > 0 ? t('resendIn', { seconds: String(resendCooldown) }) : t('resendCode')}
                </button>
                <span className="text-text-muted">{t('otpHelp')}</span>
              </div>
              {error === 'auth.signup.newCodeSent' && (
                <div className="text-brand-secondary text-sm text-center">{t('newCodeSent')}</div>
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

          {error && <InlineError message={t(error)} className="text-center" />}

          <div className="text-center text-sm lg:text-base">
            <Link href="/auth/signin" className="font-medium text-brand-primary hover:text-brand-primary-hover transition-colors duration-300">
              {t('haveAccount')}
            </Link>
          </div>
        </div>
        </FocusTrap>
      </AuthCard>
    </AuthSplitLayout>
  )
}

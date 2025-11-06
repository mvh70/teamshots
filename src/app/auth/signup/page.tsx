'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import { jsonFetcher } from '@/lib/fetcher'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import AuthButton from '@/components/auth/AuthButton'
import FocusTrap from '@/components/auth/FocusTrap'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { PRICING_CONFIG } from '@/config/pricing'

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
          // New flow: after OTP, user is on free plan with 10 credits
          router.push('/en/app/dashboard')
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
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-light via-white to-brand-cta-light rounded-2xl" />
          <div className="relative p-10">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t('welcome')}</h1>
            <p className="text-gray-700 mb-8 text-lg">{t('welcomeSubtitle')}</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 bg-brand-cta rounded-full" />
                <span className="text-gray-700">{t('benefit1')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 bg-brand-cta rounded-full" />
                <span className="text-gray-700">{t('benefit2')}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 bg-brand-cta rounded-full" />
                <span className="text-gray-700">{t('benefit3')}</span>
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
            <div className="flex justify-center mb-2">
              <span className="inline-flex items-center bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                {t('freeBadge', { default: 'Includes 1 free generation' })}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className={`h-1.5 w-24 rounded-full ${step === 1 ? 'bg-brand-primary' : 'bg-brand-primary-light'}`} />
              <div className={`h-1.5 w-24 rounded-full ${step === 2 ? 'bg-brand-primary' : 'bg-brand-primary-light'}`} />
            </div>
            <p className="mt-2 text-gray-600">{t('stepOf', { step: String(step) })}</p>
          </div>
        }
      >
        <FocusTrap>
        <div className="space-y-6">
          {step === 1 && (
            <>
              {/* Plan summary (inferred from entry point) */}
              {inferredTier || isTryOnce ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                  {isTryOnce ? (
                    <div>
                      <strong>{t('planTryOnce')}:</strong> {t('planSummaryTryOnce', { credits: PRICING_CONFIG.tryOnce.credits, photos: calculatePhotosFromCredits(PRICING_CONFIG.tryOnce.credits) })}
                    </div>
                  ) : inferredTier === 'team' ? (
                    <div>
                      <strong>{t('planPro')}:</strong> {t('planSummaryPro', { credits: PRICING_CONFIG.pro.includedCredits, photos: calculatePhotosFromCredits(PRICING_CONFIG.pro.includedCredits) })}
                    </div>
                  ) : (
                    <div>
                      <strong>{t('planIndividual')}:</strong> {t('planSummaryIndividual', { credits: PRICING_CONFIG.individual.includedCredits, photos: calculatePhotosFromCredits(PRICING_CONFIG.individual.includedCredits) })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 space-y-3">
                  <div className="text-sm text-gray-800">
                    {t('selectPlanPrompt')}: <strong>{t('planIndividual')}</strong> or <strong>{t('planPro')}</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, userType: 'individual' })}
                      className={`p-4 border-2 rounded-lg text-left transition-colors ${
                        formData.userType === 'individual'
                          ? 'border-brand-primary bg-brand-primary-light'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{t('individual')}</div>
                      <div className="mt-1 text-sm text-gray-600">{t('individualDesc')}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, userType: 'team' })}
                      className={`p-4 border-2 rounded-lg text-left transition-colors ${
                        formData.userType === 'team'
                          ? 'border-brand-primary bg-brand-primary-light'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{t('team')}</div>
                      <div className="mt-1 text-sm text-gray-600">{t('teamDesc')}</div>
                    </button>
                  </div>
                </div>
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
                isLoading={isLoading}
                disabled={isLoading || !formData.email || !formData.password || formData.password !== formData.confirmPassword || !formData.firstName}
              >
                {isLoading ? t('sending') : t('sendCode')}
              </AuthButton>
            </>
          )}

          {step === 2 && (
            <>
              {infoMessage && (
                <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-3 text-center mb-2">
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
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-brand-primary hover:text-brand-primary-hover disabled:opacity-50"
                  onClick={handleSendOTP}
                  disabled={resendCooldown > 0 || isLoading}
                >
                  {resendCooldown > 0 ? t('resendIn', { seconds: String(resendCooldown) }) : t('resendCode')}
                </button>
                <span className="text-gray-500">{t('otpHelp')}</span>
              </div>
              {error === 'auth.signup.newCodeSent' && (
                <div className="text-brand-secondary text-sm text-center">{t('newCodeSent')}</div>
              )}
              <AuthButton
                type="button"
                onClick={handleVerifyOTP}
                isLoading={isLoading}
                disabled={isLoading || formData.otpCode.length !== 6}
              >
                {isLoading ? t('verifying') : t('verifyCode')}
              </AuthButton>
            </>
          )}

          {error && (
            <div className="text-red-600 text-sm text-center">{t(error)}</div>
          )}

          <div className="text-center">
            <Link href="/auth/signin" className="font-medium text-brand-primary hover:text-brand-primary-hover">
              {t('haveAccount')}
            </Link>
          </div>
        </div>
        </FocusTrap>
      </AuthCard>
    </AuthSplitLayout>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { signIn } from 'next-auth/react'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import AuthButton from '@/components/auth/AuthButton'
import FocusTrap from '@/components/auth/FocusTrap'
import { jsonFetcher } from '@/lib/fetcher'

export default function VerifyPage() {
  const t = useTranslations('auth.signup')
  const searchParams = useSearchParams()
  const router = useRouter()

  const [otpCode, setOtpCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const email = searchParams.get('email') || ''
  const tier = searchParams.get('tier') || ''

  // Load pending signup fields from sessionStorage
  const [pending, setPending] = useState<{ email: string; firstName: string; password: string; userType: 'individual' | 'team' } | null>(null)

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem('teamshots.pendingSignup') : null
      if (raw) {
        const parsed = JSON.parse(raw) as { email: string; firstName: string; password: string; userType: 'individual' | 'team' }
        setPending(parsed)
      }
    } catch {}

    // Info banner and auto-send OTP
    const planKey = tier === 'pro' ? 'planPro' : tier === 'individual' ? 'planIndividual' : 'planGeneric'
    setInfoMessage(
      t('info.checkoutSuccess', { plan: t(planKey), email })
    )
    const targetEmail = email || (typeof window !== 'undefined' ? (window.sessionStorage.getItem('teamshots.pendingSignup') ? (JSON.parse(window.sessionStorage.getItem('teamshots.pendingSignup') as string) as {email: string}).email : '') : '')
    if (targetEmail) {
      try {
        const lastSentAtStr = typeof window !== 'undefined' ? window.sessionStorage.getItem('teamshots.otpLastSentAt') : null
        const lastSentAt = lastSentAtStr ? parseInt(lastSentAtStr, 10) : 0
        const secondsSince = lastSentAt ? Math.floor((Date.now() - lastSentAt) / 1000) : Number.MAX_SAFE_INTEGER
        if (secondsSince < 60) {
          setResendCooldown(Math.max(60 - secondsSince, 1))
          return
        }
      } catch {}

      jsonFetcher<{ throttled?: boolean; wait?: number; message?: string }>('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, locale: 'en' }),
      }).then((data) => {
        const wait = data?.throttled && typeof data.wait === 'number' ? data.wait : 30
        setResendCooldown(wait)
        try { if (typeof window !== 'undefined') window.sessionStorage.setItem('teamshots.otpLastSentAt', String(Date.now())) } catch {}
      }).catch(() => {})
    }
  }, [email, tier, t])

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleVerify = async () => {
    setIsLoading(true)
    setError('')
    try {
      const payload = {
        email: pending?.email || email,
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
          setError('Invalid OTP')
        } else {
          setError('An error occurred')
        }
        return
      }

      if (registerData.success) {
        // Clear temporary storage
        try { window.sessionStorage.removeItem('teamshots.pendingSignup') } catch {}

        const signInResult = await signIn('credentials', {
          email: payload.email,
          password: payload.password,
          redirect: false,
        })
        if (signInResult?.error) {
          router.push('/auth/signin')
        } else {
          router.push('/en/app/dashboard')
        }
        return
      }

      setError((registerData.error as string) || 'Registration failed')
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
          </div>
        </div>
      }
    >
      <AuthCard title={t('title')}>
        <FocusTrap>
          <div className="space-y-6">
            {infoMessage && (
              <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-5 shadow-lg">
                {/* decorative confetti */}
                <div className="pointer-events-none absolute -top-3 -left-3 h-16 w-16 rounded-full bg-emerald-400/20 blur-xl" />
                <div className="pointer-events-none absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-emerald-300/20 blur-xl" />
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l3-3z" clipRule="evenodd"/></svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-extrabold text-emerald-800">{t('bannerTitle')}</div>
                    <p className="mt-1 text-sm text-emerald-900/80">{infoMessage}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{t('didntReceiveCode')}</span>
              <button
                type="button"
                disabled={resendCooldown > 0 || isLoading}
                onClick={async () => {
                  const targetEmail = email || pending?.email || ''
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
                    try { if (typeof window !== 'undefined') window.sessionStorage.setItem('teamshots.otpLastSentAt', String(Date.now())) } catch {}
                  } catch {
                    // ignore
                  } finally {
                    setIsLoading(false)
                  }
                }}
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
              hint={t('enterCodeFor', { email: email || pending?.email || '' })}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />
            <AuthButton
              type="button"
              onClick={handleVerify}
              isLoading={isLoading}
              disabled={isLoading || otpCode.length !== 6}
            >
              {isLoading ? t('verifying') : t('verifyCode')}
            </AuthButton>
            {error && <div className="text-red-600 text-sm text-center">{t(error) || error}</div>}
          </div>
        </FocusTrap>
      </AuthCard>
    </AuthSplitLayout>
  )
}



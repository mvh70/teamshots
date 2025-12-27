'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { jsonFetcher } from '@/lib/fetcher'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import { AuthButton, InlineError } from '@/components/ui'
import FocusTrap from '@/components/auth/FocusTrap'

type TokenStatus = 'loading' | 'valid' | 'invalid' | 'expired'

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword')
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const token = searchParams.get('token')
  
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Verify token on page load
  useEffect(() => {
    if (!token) {
      setTokenStatus('invalid')
      return
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
        const data = await response.json()
        
        if (response.ok && data.data?.valid) {
          setTokenStatus('valid')
          setEmail(data.data.email || '')
        } else if (data.code === 'TOKEN_INVALID' && data.message?.includes('expired')) {
          setTokenStatus('expired')
        } else {
          setTokenStatus('invalid')
        }
      } catch {
        setTokenStatus('invalid')
      }
    }

    verifyToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }

    if (password.length < 8) {
      setError(t('passwordTooShort'))
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const data = await jsonFetcher<{ success?: boolean; data?: { email: string }; error?: string; message?: string }>('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (data.success || data.data?.email) {
        setSuccess(true)
        
        // Auto sign-in the user
        const signInResult = await signIn('credentials', {
          email: email,
          password: password,
          redirect: false,
        })

        if (signInResult?.ok) {
          // Redirect to dashboard
          router.push('/app/dashboard')
        } else {
          // If auto sign-in fails, redirect to sign-in page
          router.push('/auth/signin?from=reset-password')
        }
      } else {
        setError(data.message || data.error || t('genericError'))
      }
    } catch {
      setError(t('genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state
  if (tokenStatus === 'loading') {
    return (
      <AuthSplitLayout
        left={
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 rounded-3xl shadow-xl border border-white/20 backdrop-blur-sm" />
            <div className="relative p-12 lg:p-14">
              <h1 className="text-5xl lg:text-6xl font-display font-bold text-slate-900 mb-6">{t('title')}</h1>
              <p className="text-xl lg:text-2xl text-slate-600 mb-12">{t('subtitle')}</p>
            </div>
          </div>
        }
      >
        <AuthCard title={t('verifying')}>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </AuthCard>
      </AuthSplitLayout>
    )
  }

  // Invalid or expired token
  if (tokenStatus === 'invalid' || tokenStatus === 'expired') {
    return (
      <AuthSplitLayout
        left={
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-yellow-500/10 rounded-3xl shadow-xl border border-white/20 backdrop-blur-sm" />
            <div className="relative p-12 lg:p-14">
              <h1 className="text-5xl lg:text-6xl font-display font-bold text-slate-900 mb-6">{t('linkProblem')}</h1>
              <p className="text-xl lg:text-2xl text-slate-600 mb-12">
                {tokenStatus === 'expired' ? t('linkExpiredDescription') : t('linkInvalidDescription')}
              </p>
            </div>
          </div>
        }
      >
        <AuthCard title={tokenStatus === 'expired' ? t('linkExpired') : t('linkInvalid')}>
          <div className="space-y-6 text-center">
            <p className="text-slate-600">
              {tokenStatus === 'expired' ? t('linkExpiredHelp') : t('linkInvalidHelp')}
            </p>
            <div className="pt-4 space-y-3">
              <Link 
                href="/auth/forgot-password" 
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                {t('requestNewLink')}
              </Link>
              <Link 
                href="/auth/signin" 
                className="inline-flex items-center justify-center w-full px-6 py-3 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                {t('goToSignIn')}
              </Link>
            </div>
          </div>
        </AuthCard>
      </AuthSplitLayout>
    )
  }

  // Success state (brief, before redirect)
  if (success) {
    return (
      <AuthSplitLayout
        left={
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-teal-500/10 rounded-3xl shadow-xl border border-white/20 backdrop-blur-sm" />
            <div className="relative p-12 lg:p-14">
              <h1 className="text-5xl lg:text-6xl font-display font-bold text-slate-900 mb-6">{t('successTitle')}</h1>
              <p className="text-xl lg:text-2xl text-slate-600">{t('successDescription')}</p>
            </div>
          </div>
        }
      >
        <AuthCard title={t('success')}>
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-slate-600">{t('redirecting')}</p>
          </div>
        </AuthCard>
      </AuthSplitLayout>
    )
  }

  // Valid token - show password form
  return (
    <AuthSplitLayout
      left={
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 rounded-3xl shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-500 group-hover:shadow-2xl group-hover:from-blue-500/15 group-hover:via-purple-500/8 group-hover:to-pink-500/15" />
          <div className="relative p-12 lg:p-14">
            <h1 className="text-5xl lg:text-6xl font-display font-bold text-slate-900 mb-6 tracking-tight leading-tight bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">
              {t('welcomeTitle')}
            </h1>
            <p className="text-xl lg:text-2xl text-slate-600 mb-12 leading-relaxed font-medium">
              {t('welcomeSubtitle')}
            </p>
          </div>
        </div>
      }
    >
      <AuthCard
        title={t('title')}
        subtitle={
          <div className="text-center">
            <p className="text-slate-600">{t('forEmail', { email })}</p>
          </div>
        }
      >
        <FocusTrap>
          <form onSubmit={handleSubmit} className="space-y-7 lg:space-y-8">
            <AuthInput
              id="password"
              name="password"
              type="password"
              required
              label={t('passwordLabel')}
              strengthMeter
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            
            <AuthInput
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              label={t('confirmPasswordLabel')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            {error && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <InlineError message={error} className="text-center bg-red-50/50 py-3 px-4 rounded-lg border border-red-200" />
              </div>
            )}

            <AuthButton
              type="submit"
              loading={isLoading}
              disabled={isLoading || !password || !confirmPassword}
            >
              {isLoading ? t('resetting') : t('resetPassword')}
            </AuthButton>
          </form>
        </FocusTrap>
      </AuthCard>
    </AuthSplitLayout>
  )
}


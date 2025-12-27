'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { jsonFetcher } from '@/lib/fetcher'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import { AuthButton, InlineError } from '@/components/ui'
import FocusTrap from '@/components/auth/FocusTrap'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const data = await jsonFetcher<{ success?: boolean; error?: string; message?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.error || data.message || t('genericError'))
      }
    } catch {
      setError(t('genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <AuthSplitLayout
        left={
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-teal-500/10 rounded-3xl shadow-xl border border-white/20 backdrop-blur-sm" />
            <div className="relative p-12 lg:p-14">
              <h1 className="text-5xl lg:text-6xl font-display font-bold text-slate-900 mb-6">{t('successTitle')}</h1>
              <p className="text-xl lg:text-2xl text-slate-600 mb-12">{t('successDescription')}</p>
            </div>
          </div>
        }
      >
        <AuthCard title={t('checkEmail')}>
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-slate-600">{t('emailSent', { email })}</p>
            <p className="text-sm text-slate-500">{t('checkSpam')}</p>
            <div className="pt-4">
              <Link 
                href="/auth/signin" 
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                {t('backToSignIn')}
              </Link>
            </div>
          </div>
        </AuthCard>
      </AuthSplitLayout>
    )
  }

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
        subtitle={t('subtitle')}
      >
        <FocusTrap>
          <form onSubmit={handleSubmit} className="space-y-7 lg:space-y-8">
            <AuthInput
              id="email"
              name="email"
              type="email"
              required
              label={t('emailLabel')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <InlineError message={error} className="text-center bg-red-50/50 py-3 px-4 rounded-lg border border-red-200" />
              </div>
            )}

            <AuthButton
              type="submit"
              loading={isLoading}
              disabled={isLoading || !email}
            >
              {isLoading ? t('sending') : t('sendResetLink')}
            </AuthButton>

            <div className="text-center pt-3">
              <Link href="/auth/signin" className="text-sm lg:text-base font-semibold text-blue-600 hover:text-blue-700 transition-all duration-200 hover:underline underline-offset-4 decoration-2">
                {t('backToSignIn')}
              </Link>
            </div>
          </form>
        </FocusTrap>
      </AuthCard>
    </AuthSplitLayout>
  )
}


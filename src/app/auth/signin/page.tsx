'use client'

import { useState } from 'react'
import {useTranslations} from 'next-intl'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import { AuthButton, InlineError } from '@/components/ui'
import FocusTrap from '@/components/auth/FocusTrap'

export default function SignInPage() {
  const t = useTranslations('auth.signin')
  const searchParams = useSearchParams()
  const track = (event: string, props?: Record<string, unknown>) => {
    try {
      // @ts-expect-error analytics may be injected at runtime
      if (typeof window !== 'undefined' && window?.analytics?.track) {
        // @ts-expect-error analytics may be injected at runtime
        window.analytics.track(event, props)
      }
    } catch {}
  }
  const emailParam = searchParams.get('email')
  const initialEmail = emailParam || ''
  const initialError = emailParam ? 'auth.signup.accountExists' : ''

  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [useMagicLink, setUseMagicLink] = useState(false)

  const router = useRouter()

  // Helper function to safely redirect to callbackUrl if present
  const redirectToCallbackOrDefault = (defaultPath: string) => {
    const callbackUrl = searchParams.get('callbackUrl')
    if (callbackUrl) {
      try {
        const url = new URL(callbackUrl, window.location.origin)
        // Only allow same origin redirects for security
        if (url.origin === window.location.origin) {
          router.push(callbackUrl)
          track('signin_success')
          return true
        }
      } catch {
        // Invalid URL, fall through to default redirect
      }
    }
    router.push(defaultPath)
    track('signin_success')
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (useMagicLink) {
        // Send magic link
        const result = await signIn('email', {
          email,
          redirect: false,
          // Pass email forward so verify page can display it
          callbackUrl: `/auth/verify-request?email=${encodeURIComponent(email)}`,
        })

        if (result?.error) {
          setError('Failed to send magic link')
          track('signin_magiclink_error', { reason: result.error })
        } else {
          // Redirect to verification page
          router.push(`/auth/verify-request?email=${encodeURIComponent(email)}`)
          track('signin_magiclink_sent', { email })
        }
      } else {
        // Password authentication
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError('Invalid credentials')
          track('signin_error', { reason: result.error })
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
                
                // Check for callbackUrl from middleware redirect (e.g., after Stripe checkout)
                // If callbackUrl exists, redirect there; otherwise use default based on onboarding
                const defaultPath = data.onboarding?.needsTeamSetup ? '/app/team' : '/app/dashboard'
                if (redirectToCallbackOrDefault(defaultPath)) {
                  return
                }
              } else {
                // Initial data fetch failed, but still check for callbackUrl
                if (redirectToCallbackOrDefault('/app/dashboard')) {
                  return
                }
              }
            } catch {
              // Fetch failed, but still check for callbackUrl
              if (redirectToCallbackOrDefault('/app/dashboard')) {
                return
              }
            }
          } else {
            // Session missing, but still check for callbackUrl
            if (redirectToCallbackOrDefault('/app/dashboard')) {
              return
            }
          }
        }
      }
    } catch {
      setError('An error occurred')
      track('signin_exception')
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
            <h1 className="text-5xl lg:text-6xl font-display font-bold text-slate-900 mb-6 tracking-tight leading-tight bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">{t('welcomeBack')}</h1>
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
      <AuthCard title={t('title')}>
        <FocusTrap>
        <form className="space-y-7 lg:space-y-8" onSubmit={handleSubmit}>
          <AuthInput
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            placeholder={t('emailPlaceholder')}
            label={t('emailLabel')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {!useMagicLink && (
            <AuthInput
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder={t('passwordPlaceholder')}
              label={t('passwordLabel')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer hover:text-slate-700 transition-colors">
              <input
                id="magic-link"
                name="magic-link"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 focus:ring-2 border-slate-200 rounded transition-all duration-200 cursor-pointer bg-white"
                checked={useMagicLink}
                onChange={(e) => setUseMagicLink(e.target.checked)}
              />
              <span className="font-medium">{t('useMagicLink')}</span>
            </label>
            <a href="#" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-all duration-200 hover:underline underline-offset-2 decoration-2">{t('forgotPassword')}</a>
          </div>
          {error && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <InlineError message={t(error)} className="text-center bg-red-50/50 py-3 px-4 rounded-lg border border-red-200" />
            </div>
          )}
          <AuthButton type="submit" loading={isLoading}>
            {isLoading ? t('signingIn') : t('submit')}
          </AuthButton>
          <div className="text-center pt-3">
            <Link href="/auth/signup" className="text-sm lg:text-base font-semibold text-blue-600 hover:text-blue-700 transition-all duration-200 hover:underline underline-offset-4 decoration-2">
              {t('noAccount')}
            </Link>
          </div>
        </form>
        </FocusTrap>
      </AuthCard>
    </AuthSplitLayout>
  )
}

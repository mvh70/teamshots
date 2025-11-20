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
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-light via-bg-white to-brand-cta-light rounded-3xl shadow-depth-lg" />
          <div className="relative p-10 lg:p-12">
            <h1 className="text-4xl lg:text-5xl font-display font-bold text-text-dark mb-6">{t('welcomeBack')}</h1>
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
      <AuthCard title={t('title')}>
        <FocusTrap>
        <form className="space-y-6 lg:space-y-7" onSubmit={handleSubmit}>
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
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-text-body">
              <input
                id="magic-link"
                name="magic-link"
                type="checkbox"
                className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-brand-primary-lighter rounded transition-colors duration-300"
                checked={useMagicLink}
                onChange={(e) => setUseMagicLink(e.target.checked)}
              />
              {t('useMagicLink')}
            </label>
            <a href="#" className="text-sm text-brand-primary hover:text-brand-primary-hover transition-colors duration-300">{t('forgotPassword')}</a>
          </div>
          {error && <InlineError message={t(error)} className="text-center" />}
          <AuthButton type="submit" loading={isLoading}>
            {isLoading ? t('signingIn') : t('submit')}
          </AuthButton>
          <div className="text-center text-sm lg:text-base">
            <Link href="/auth/signup" className="font-medium text-brand-primary hover:text-brand-primary-hover transition-colors duration-300">
              {t('noAccount')}
            </Link>
          </div>
        </form>
        </FocusTrap>
      </AuthCard>
    </AuthSplitLayout>
  )
}

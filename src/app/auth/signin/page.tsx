'use client'

import { useState, useEffect } from 'react'
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill email from URL parameter
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
      setError('auth.signup.accountExists')
    }
  }, [searchParams])
  const [useMagicLink, setUseMagicLink] = useState(false)

  const router = useRouter()

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
          track('signin_success')
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
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-light via-white to-brand-cta-light rounded-2xl" />
          <div className="relative p-10">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t('welcomeBack')}</h1>
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
      <AuthCard title={t('title')}>
        <FocusTrap>
        <form className="space-y-6" onSubmit={handleSubmit}>
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
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                id="magic-link"
                name="magic-link"
                type="checkbox"
                className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                checked={useMagicLink}
                onChange={(e) => setUseMagicLink(e.target.checked)}
              />
              {t('useMagicLink')}
            </label>
            <a href="#" className="text-sm text-brand-primary hover:text-brand-primary-hover">{t('forgotPassword')}</a>
          </div>
          {error && <InlineError message={t(error)} className="text-center" />}
          <AuthButton type="submit" loading={isLoading}>
            {isLoading ? t('signingIn') : t('submit')}
          </AuthButton>
          <div className="text-center text-sm">
            <Link href="/auth/signup" className="font-medium text-brand-primary hover:text-brand-primary-hover">
              {t('noAccount')}
            </Link>
          </div>
        </form>
        </FocusTrap>
      </AuthCard>
    </AuthSplitLayout>
  )
}

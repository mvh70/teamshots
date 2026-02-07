'use client'

import { useState, useEffect } from 'react'
import {useTranslations} from 'next-intl'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CameraIcon, ClockIcon, SparklesIcon } from '@heroicons/react/24/outline'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'
import AuthInput from '@/components/auth/AuthInput'
import { AuthButton, InlineError } from '@/components/ui'
import FocusTrap from '@/components/auth/FocusTrap'
import { getClientBrandInfo } from '@/config/domain'
import { trackLoginCompleted, track } from '@/lib/track'

export default function SignInPage() {
  const t = useTranslations('auth.signin')
  const tGlobal = useTranslations()
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email')
  const initialEmail = emailParam || ''
  const initialError = emailParam ? 'auth.signup.accountExists' : ''

  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [useMagicLink, setUseMagicLink] = useState(false)

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

  const getSafeCallbackPath = () => {
    const callbackUrl = searchParams.get('callbackUrl')
    // Only allow app-internal relative paths. Ignore absolute URLs.
    if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
      return callbackUrl
    }
    return '/app/dashboard'
  }

  // Check if user is already authenticated and should be redirected to their signup domain
  useEffect(() => {
    const checkAndRedirect = async () => {
      const session = await getSession()
      if (session?.user?.signupDomain) {
        const currentDomain = window.location.hostname.replace(/^www\./, '').toLowerCase()
        const normalizedSignupDomain = session.user.signupDomain.replace(/^www\./, '').toLowerCase()
        
        // Skip redirect for localhost signupDomain (legacy development users)
        // These users can access from any domain
        if (normalizedSignupDomain !== 'localhost') {
          // Redirect if on different domain and signup domain is valid
          const shouldRedirect = currentDomain !== normalizedSignupDomain &&
            ['teamshotspro.com', 'portreya.com'].includes(normalizedSignupDomain) &&
            (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_CROSS_DOMAIN_REDIRECT === 'true')
          
          if (shouldRedirect) {
            const protocol = window.location.protocol
            const currentPath = window.location.pathname + window.location.search
            const redirectUrl = `${protocol}//${normalizedSignupDomain}${currentPath}`
            window.location.href = redirectUrl
          }
        }
      }
    }
    
    checkAndRedirect()
  }, [])

  // Helper function to safely redirect to callbackUrl if present
  const redirectToCallbackOrDefault = (defaultPath: string, userId?: string) => {
    const callbackUrl = searchParams.get('callbackUrl')

    // Track login completed
    if (userId) {
      trackLoginCompleted(userId, useMagicLink ? 'magic_link' : 'email')
    }

    if (callbackUrl) {
      try {
        const url = new URL(callbackUrl, window.location.origin)
        // Only allow same origin redirects for security
        if (url.origin === window.location.origin) {
          router.push(callbackUrl)
          return true
        }
      } catch {
        // Invalid URL, fall through to default redirect
      }
    }
    router.push(defaultPath)
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Validate email before proceeding
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('errors.errorOccurred')
      setIsLoading(false)
      return
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      setError('errors.invalidCredentials')
      setIsLoading(false)
      return
    }

    try {
      if (useMagicLink) {
        // Send magic link
        // Only pass safe internal callback paths
        const callbackUrl = getSafeCallbackPath()
        const result = await signIn('email', {
          email: trimmedEmail,
          redirect: false,
          // Set callbackUrl to redirect after magic link is clicked
          callbackUrl,
        })

        if (result?.error) {
          // Log the error for debugging
          console.error('Magic link sign-in error:', result.error)
          
          // Check for rate limit error
          const errorMessage = result.error.toLowerCase()
          if (errorMessage.includes('too many') || errorMessage.includes('rate limit')) {
            setError('errors.tooManyAttempts')
          } else {
            setError('errors.magicLinkFailed')
          }
          track('signin_magiclink_error', { reason: result.error })
        } else if (result?.ok) {
          // Redirect to verification page
          router.push(`/auth/verify-request?email=${encodeURIComponent(trimmedEmail)}`)
          track('signin_magiclink_sent', { email: trimmedEmail })
        } else {
          // Unexpected result - log and show error
          console.error('Unexpected magic link result:', result)
          setError('errors.magicLinkFailed')
          track('signin_magiclink_error', { reason: 'unexpected_result' })
        }
      } else {
        // Password authentication
        if (!password.trim()) {
          setError('errors.invalidCredentials')
          setIsLoading(false)
          return
        }

        const result = await signIn('credentials', {
          email: trimmedEmail,
          password: password.trim(),
          redirect: false,
        })

        if (result?.error) {
          // Check for rate limit error
          const errorMessage = result.error.toLowerCase()
          if (errorMessage.includes('too many') || errorMessage.includes('rate limit')) {
            setError('errors.tooManyAttempts')
          } else {
            setError('errors.invalidCredentials')
          }
          track('signin_error', { reason: result.error })
        } else {
          // Fetch all initial data in one consolidated call
          const session = await getSession()
          if (session?.user) {
            // Check if user should be redirected to their signup domain
            const signupDomain = session.user.signupDomain
            if (signupDomain) {
              const currentDomain = window.location.hostname.replace(/^www\./, '').toLowerCase()
              const normalizedSignupDomain = signupDomain.replace(/^www\./, '').toLowerCase()
              
              // Skip redirect for localhost signupDomain (legacy development users)
              // These users can access from any domain
              if (normalizedSignupDomain !== 'localhost') {
                // Redirect if on different domain and signup domain is valid
                // Only redirect in production or if explicitly enabled for testing
                const shouldRedirect = currentDomain !== normalizedSignupDomain &&
                  ['teamshotspro.com', 'portreya.com'].includes(normalizedSignupDomain) &&
                  (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_CROSS_DOMAIN_REDIRECT === 'true')
                
                if (shouldRedirect) {
                  const protocol = window.location.protocol
                  const currentPath = window.location.pathname + window.location.search
                  const redirectUrl = `${protocol}//${normalizedSignupDomain}${currentPath}`
                  window.location.href = redirectUrl
                  return
                }
              }
            }
            
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
                const defaultPath = data.onboarding?.needsTeamSetup && !isIndividual ? '/app/team' : '/app/dashboard'
                if (redirectToCallbackOrDefault(defaultPath, session.user.id)) {
                  return
                }
              } else {
                // Initial data fetch failed, but still check for callbackUrl
                if (redirectToCallbackOrDefault('/app/dashboard', session.user.id)) {
                  return
                }
              }
            } catch {
              // Fetch failed, but still check for callbackUrl
              if (redirectToCallbackOrDefault('/app/dashboard', session?.user?.id)) {
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
    } catch (error) {
      // Log the full error for debugging
      console.error('Sign-in exception:', error)
      setError('errors.errorOccurred')
      track('signin_exception', { error: error instanceof Error ? error.message : String(error) })
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
          Welcome
          <span className="block text-[#B45309]">Back</span>
        </h1>

        <p className="text-lg text-[#0F172A]/70 mb-10 leading-relaxed">
          Sign in to access your professional headshots and continue creating your perfect image.
        </p>

        {/* Benefits */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 group">
            <div className="w-10 h-10 flex items-center justify-center border border-[#B45309]/20 text-[#B45309]">
              <CameraIcon className="w-5 h-5" />
            </div>
            <span className="text-[#0F172A]/80 font-medium">{t('benefit1Individual')}</span>
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
            <span className="text-[#0F172A]/80 font-medium">{t('benefit3')}</span>
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
        <h1 className="text-5xl lg:text-6xl font-display font-bold text-slate-900 mb-6 tracking-tight leading-tight bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">{t('welcomeBack')}</h1>
        <p className="text-xl lg:text-2xl text-slate-600 mb-12 leading-relaxed font-medium">{t('welcomeSubtitle')}</p>
        <div className="space-y-6">
          <div className="flex items-center gap-4 transform transition-all duration-200 hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none">
            <span className="w-3 h-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full shadow-sm animate-pulse motion-reduce:animate-none" style={{ animationDuration: '2s' }} aria-hidden="true" />
            <span className="text-lg lg:text-xl text-slate-700 font-medium">{t('benefit1')}</span>
          </div>
          <div className="flex items-center gap-4 transform transition-all duration-200 hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none" style={{ transitionDelay: '50ms' }}>
            <span className="w-3 h-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-sm animate-pulse motion-reduce:animate-none" style={{ animationDuration: '2s', animationDelay: '0.5s' }} aria-hidden="true" />
            <span className="text-lg lg:text-xl text-slate-700 font-medium">{t('benefit2')}</span>
          </div>
          <div className="flex items-center gap-4 transform transition-all duration-200 hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none" style={{ transitionDelay: '100ms' }}>
            <span className="w-3 h-3 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full shadow-sm animate-pulse motion-reduce:animate-none" style={{ animationDuration: '2s', animationDelay: '1s' }} aria-hidden="true" />
            <span className="text-lg lg:text-xl text-slate-700 font-medium">{t('benefit3')}</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <AuthSplitLayout
      left={isIndividual ? photoShotsProLeft : teamShotsProLeft}
    >
      <AuthCard title={t('title')}>
        <FocusTrap>
        {/* Google Sign-In Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: getSafeCallbackPath() })}
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
            {t('continueWithGoogle')}
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-slate-500 font-medium">{t('orContinueWith')}</span>
          </div>
        </div>

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
            <label 
              className="inline-flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer hover:text-slate-700 transition-colors"
              onClick={(e) => {
                // Prevent form submission when clicking the label
                e.stopPropagation()
              }}
            >
              <input
                id="magic-link"
                name="magic-link"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 focus:ring-2 border-slate-200 rounded transition-all duration-200 cursor-pointer bg-white"
                checked={useMagicLink}
                onChange={(e) => {
                  e.stopPropagation()
                  setUseMagicLink(e.target.checked)
                  // Clear password when switching to magic link
                  if (e.target.checked) {
                    setPassword('')
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="font-medium">{t('useMagicLink')}</span>
            </label>
            <Link href="/auth/forgot-password" className={`text-sm font-semibold transition-all duration-200 hover:underline underline-offset-2 decoration-2 ${
              isIndividual ? 'text-[#B45309] hover:text-[#92400E]' : 'text-blue-600 hover:text-blue-700'
            }`}>{t('forgotPassword')}</Link>
          </div>
          {error && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <InlineError message={error.startsWith('auth.') ? tGlobal(error) : t(error)} className="text-center bg-red-50/50 py-3 px-4 rounded-lg border border-red-200" />
            </div>
          )}
          <AuthButton type="submit" loading={isLoading}>
            {isLoading ? t('signingIn') : t('submit')}
          </AuthButton>
          <div className="text-center pt-3">
            <Link href="/auth/signup" className={`text-sm lg:text-base font-semibold transition-all duration-200 hover:underline underline-offset-4 decoration-2 ${
              isIndividual ? 'text-[#B45309] hover:text-[#92400E]' : 'text-blue-600 hover:text-blue-700'
            }`}>
              {t('noAccount')}
            </Link>
          </div>
        </form>
        </FocusTrap>
      </AuthCard>
    </AuthSplitLayout>
  )
}

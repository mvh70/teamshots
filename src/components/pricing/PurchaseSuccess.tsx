'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from '@/i18n/routing'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { PRICING_CONFIG } from '@/config/pricing'
import { calculatePhotosFromCredits } from '@/domain/pricing'
import { useCredits } from '@/contexts/CreditsContext'
import { trackPaymentCompleted } from '@/lib/track'
import { getCleanClientBaseUrl } from '@/lib/url'

interface PurchaseSuccessProps {
  className?: string
}

export function PurchaseSuccess({ className = '' }: PurchaseSuccessProps) {
  const t = useTranslations('pricing.purchaseSuccess')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { refetch: refetchCredits, loading: creditsLoading } = useCredits()
  const [planType, setPlanType] = useState<'individual' | 'vip' | 'topUp' | 'seats' | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const hasTrackedRef = useRef(false)

  useEffect(() => {
    const successType = searchParams.get('type')
    // Map success types from checkout to plan types
    if (successType === 'individual_success') {
      setPlanType('individual')
    } else if (successType === 'vip_success') {
      setPlanType('vip')
    } else if (successType === 'top_up_success') {
      setPlanType('topUp')
    } else if (successType === 'seats_success') {
      setPlanType('seats')
    }
  }, [searchParams])

  // Track payment completion (conversion from free to paid)
  useEffect(() => {
    if (planType && !hasTrackedRef.current) {
      hasTrackedRef.current = true

      // Get additional details from URL params
      const seatsParam = searchParams.get('seats')
      const creditsParam = searchParams.get('credits')

      trackPaymentCompleted({
        plan_tier: planType === 'topUp' ? 'top_up' : planType,
        plan_period: planType === 'seats' ? 'seats' : (planType === 'vip' ? 'large' : 'small'),
        seat_count: seatsParam ? parseInt(seatsParam, 10) : undefined,
      })
    }
  }, [planType, searchParams])

  // Refresh credits when component mounts (user just completed purchase)
  useEffect(() => {
    // Aggressively clear all cached credit data to ensure fresh fetch
    try {
      // Clear sessionStorage cache
      const stored = sessionStorage.getItem('teamshots.initialData')
      if (stored) {
        const initialData = JSON.parse(stored)
        delete initialData.credits
        initialData._timestamp = 0
        sessionStorage.setItem('teamshots.initialData', JSON.stringify(initialData))
      }
      
      // Also remove any other credit-related cache keys
      sessionStorage.removeItem('teamshots.credits')
    } catch {
      // Ignore errors
    }
    
    // Now fetch fresh credits from the API
    refetchCredits()
  }, [refetchCredits])

  if (!planType) return null

  const getPlanDetails = () => {
    const creditsPerGeneration = PRICING_CONFIG.credits.perGeneration
    
    switch (planType) {
      case 'individual': {
        const credits = PRICING_CONFIG.individual.credits
        const regenerations = PRICING_CONFIG.regenerations.individual
        const uniquePhotos = credits / creditsPerGeneration // 6 unique photos
        const variationsPerPhoto = regenerations + 1 // 1 original + retries = 4 variations
        const totalVariations = uniquePhotos * variationsPerPhoto // 6 × 4 = 24
        
        return {
          title: t('individual.title'),
          features: [
            t('individual.credits', { uniquePhotos }),
            t('individual.retriesAndVariations', { retries: regenerations, totalVariations }),
            t('individual.styles')
          ]
        }
      }
      case 'vip': {
        const credits = PRICING_CONFIG.vip.credits
        const regenerations = PRICING_CONFIG.regenerations.vip
        const uniquePhotos = credits / creditsPerGeneration
        const variationsPerPhoto = regenerations + 1
        const totalVariations = uniquePhotos * variationsPerPhoto

        return {
          title: t('vip.title', { default: 'VIP' }),
          features: [
            t('vip.credits', { uniquePhotos, default: `${uniquePhotos} unique photos` }),
            t('vip.retriesAndVariations', { retries: regenerations, totalVariations, default: `${regenerations} retries per photo, ${totalVariations} total variations` }),
            t('vip.styles', { default: 'Full customization options' })
          ]
        }
      }
      case 'topUp': {
        const creditsParam = searchParams.get('credits')
        const credits = creditsParam ? parseInt(creditsParam, 10) : 0
        const photos = calculatePhotosFromCredits(credits)

        return {
          title: t('topUp.title'), // Add translation key
          features: [
            t('topUp.credits', { photos }) // Add translation key
          ]
        }
      }
      case 'seats': {
        // Get seats count from URL
        const seatsParam = searchParams.get('seats')
        const seats = seatsParam ? parseInt(seatsParam, 10) : 2
        
        // Check if this is additional seats (isTopUp parameter)
        const isTopUp = searchParams.get('isTopUp') === 'true'
        
        // Calculate credits and photos
        const creditsPerSeat = PRICING_CONFIG.seats.creditsPerSeat
        const totalCredits = seats * creditsPerSeat
        const photosPerSeat = creditsPerSeat / PRICING_CONFIG.credits.perGeneration
        
        return {
          title: isTopUp 
            ? t('seats.additionalTitle', { seats, default: `${seats} Additional Seats` })
            : t('seats.upgradeTitle', { seats, default: `Team Plan - ${seats} Seats` }),
          features: [
            isTopUp
              ? t('seats.additionalDescription', { seats, photosPerSeat, default: `Added ${seats} seats with ${photosPerSeat} photos each` })
              : t('seats.upgradeDescription', { seats, photosPerSeat, default: `${seats} team seats with ${photosPerSeat} photos each` }),
            t('seats.allFeatures', { default: 'Full customization options' })
          ]
        }
      }
    }
  }

  const planDetails = getPlanDetails()

  // Determine where to redirect and what button text to show
  const getRedirectInfo = () => {
    // Check for finalDestination parameter (set when checkout is from upgrade/top-up)
    const finalDestination = searchParams.get('finalDestination')
    if (finalDestination === 'dashboard') {
      // Check if we're already on dashboard (compare without locale prefix)
      const currentPathNormalized = pathname.replace(/^\/(en|es)/, '') || pathname
      if (currentPathNormalized === '/app/dashboard') {
        return { path: null, buttonText: t('continueToDashboard'), clearParams: true }
      }
      return { path: '/app/dashboard', buttonText: t('continueToDashboard'), clearParams: false }
    }

    // Check for returnTo parameter (set when checkout is from elsewhere)
    const returnTo = searchParams.get('returnTo')
    if (returnTo) {
      try {
        const decodedUrl = decodeURIComponent(returnTo)
        // Validate it's a relative path or same hostname for security
        // Use clean base URL to handle proxy port issues (e.g. :80 in origin)
        const isSameHostname = (() => {
          try {
            const url = new URL(decodedUrl, getCleanClientBaseUrl())
            return url.hostname === window.location.hostname
          } catch {
            return false
          }
        })()
        if (decodedUrl.startsWith('/') || isSameHostname) {
          // Extract pathname from URL (remove query params and hash)
          const returnToPath = decodedUrl.split('?')[0].split('#')[0]
          const returnToPathNormalized = returnToPath.replace(/^\/(en|es)/, '') || returnToPath
          const currentPathNormalized = pathname.replace(/^\/(en|es)/, '') || pathname

          // Check if we're already on the destination page
          if (returnToPathNormalized === currentPathNormalized) {
            // We're already here, just clear the success params
            const isGenerationPage = returnToPath.includes('/app/generate/start')
            return {
              path: null,
              buttonText: isGenerationPage ? t('continueToGeneration') : t('continueToDashboard'),
              clearParams: true
            }
          }

          // Determine button text based on destination
          const isGenerationPage = decodedUrl.includes('/app/generate/start')
          return {
            path: decodedUrl,
            buttonText: isGenerationPage ? t('continueToGeneration') : t('continueToDashboard'),
            clearParams: false
          }
        }
      } catch (e) {
        // If decoding fails, fall through to default behavior
        console.error('Failed to decode returnTo URL:', e)
      }
    }

    // Fallback to default behavior
    const currentPathNormalized = pathname.replace(/^\/(en|es)/, '') || pathname
    
    // Check if we're already on the generation page
    if (currentPathNormalized === '/app/generate/start') {
      // Already on generation page, just clear params
      return { path: null, buttonText: t('continueToGenerate'), clearParams: true }
    }
    
    // Check if we're already on the dashboard
    if (currentPathNormalized === '/app/dashboard') {
      // Already on dashboard, just clear params
      return { path: null, buttonText: t('continueToDashboard'), clearParams: true }
    }
    
    // Not on either page - decide where to go based on plan type
    {
      // Other plan types go to dashboard
      return { path: '/app/dashboard', buttonText: t('continueToDashboard'), clearParams: false }
    }
  }

  const redirectInfo = getRedirectInfo()

  const handleContinue = async () => {
    setIsNavigating(true)
    
    // Force a fresh credit fetch and wait for it to complete
    await refetchCredits()
    
    // Additional delay to ensure React has fully updated the credits context
    // This is critical to prevent the generation page from showing loading state
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (redirectInfo.clearParams) {
      // Clear success params from URL and stay on current page
      const params = new URLSearchParams(searchParams.toString())
      params.delete('success')
      params.delete('type')
      params.delete('returnTo')
      params.delete('finalDestination')
      params.delete('tier')
      params.delete('credits')
      
      // If we're on the generation page, ensure skipUpload=1 is preserved/added
      // This ensures the page shows the generation UI instead of redirecting to selfie selection
      const currentPathNormalized = pathname.replace(/^\/(en|es)/, '') || pathname
      if (currentPathNormalized === '/app/generate/start' && !params.has('skipUpload')) {
        params.set('skipUpload', '1')
      }
      
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`
      
      // Use push instead of replace to force a proper navigation and re-render
      // This ensures the generation page properly resets its state
      router.push(newUrl)
    } else if (redirectInfo.path) {
      // Redirect to clean path without success params to prevent target page from showing success banner
      router.push(redirectInfo.path)
    }
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-brand-secondary-light to-brand-primary-light flex items-center justify-center p-4 ${className}`}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-brand-secondary-lighter rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-8 h-8 text-brand-secondary-hover" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('title')}
          </h1>
          <p className="text-gray-600">
            {t('subtitle')}
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {planDetails.title}
          </h2>
          <ul className="space-y-3 text-left">
            {planDetails.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircleIcon className="w-3 h-3 text-white" />
                </div>
                <span className="text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={handleContinue}
          disabled={creditsLoading || isNavigating}
          className="w-full inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creditsLoading || isNavigating ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {creditsLoading ? 'Loading credits...' : 'Preparing...'}
            </>
          ) : (
            redirectInfo.buttonText
          )}
        </button>
      </div>
    </div>
  )
}

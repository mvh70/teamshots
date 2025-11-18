'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { PRICING_CONFIG } from '@/config/pricing'

interface PurchaseSuccessProps {
  className?: string
}

export function PurchaseSuccess({ className = '' }: PurchaseSuccessProps) {
  const t = useTranslations('pricing.purchaseSuccess')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [planType, setPlanType] = useState<'try_once' | 'individual' | 'pro' | null>(null)

  useEffect(() => {
    const successType = searchParams.get('type')
    if (successType === 'try_once' || successType === 'individual' || successType === 'pro') {
      setPlanType(successType)
    }
  }, [searchParams])

  if (!planType) return null

  const getPlanDetails = () => {
    const creditsPerGeneration = PRICING_CONFIG.credits.perGeneration
    
    switch (planType) {
      case 'try_once': {
        const credits = PRICING_CONFIG.tryOnce.credits
        const regenerations = PRICING_CONFIG.regenerations.tryOnce
        const uniquePhotos = credits / creditsPerGeneration // 1 unique photo
        
        return {
          title: t('tryOnce.title'),
          features: [
            t('tryOnce.credits', { count: credits, uniquePhotos }),
            t('tryOnce.retries', { count: regenerations })
          ]
        }
      }
      case 'individual': {
        const credits = PRICING_CONFIG.individual.includedCredits
        const regenerations = PRICING_CONFIG.regenerations.personal
        const uniquePhotos = credits / creditsPerGeneration // 6 unique photos
        const variationsPerPhoto = regenerations + 1 // 1 original + retries = 4 variations
        const totalVariations = uniquePhotos * variationsPerPhoto // 6 × 4 = 24
        
        return {
          title: t('individual.title'),
          features: [
            t('individual.credits', { count: credits, uniquePhotos }),
            t('individual.retriesAndVariations', { retries: regenerations, totalVariations }),
            t('individual.styles')
          ]
        }
      }
      case 'pro': {
        const credits = PRICING_CONFIG.pro.includedCredits
        const regenerations = PRICING_CONFIG.regenerations.business
        const uniquePhotos = credits / creditsPerGeneration // 20 unique photos
        const variationsPerPhoto = regenerations + 1 // 1 original + retries = 5 variations
        const totalVariations = uniquePhotos * variationsPerPhoto // 20 × 5 = 100
        
        return {
          title: t('pro.title'),
          features: [
            t('pro.credits', { count: credits, uniquePhotos }),
            t('pro.retriesAndVariations', { retries: regenerations, totalVariations }),
            t('pro.styles'),
            t('pro.team')
          ]
        }
      }
    }
  }

  const planDetails = getPlanDetails()

  const handleContinue = () => {
    if (planType === 'try_once') {
      router.push('/app/generate/start')
    } else {
      router.push('/app/dashboard')
    }
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4 ${className}`}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-8 h-8 text-green-600" />
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
          className="w-full inline-flex items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary min-h-[48px]"
        >
          {planType === 'try_once' ? t('continueToGenerate') : t('continueToDashboard')}
        </button>
      </div>
    </div>
  )
}

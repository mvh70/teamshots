
'use client'

import { useTranslations } from 'next-intl'
import { SparklesIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { getClientBrandInfo } from '@/config/domain'
import { PRICING_CONFIG } from '@/config/pricing'

interface FreePlanBannerProps {
  variant: 'personal' | 'team' | 'generic'
  className?: string
}

export function FreePlanBanner({ variant, className }: FreePlanBannerProps) {
  const t = useTranslations('contexts')
  const bodyKey =
    variant === 'personal'
      ? 'freePlan.bodyPersonal'
      : variant === 'team'
      ? 'freePlan.bodyTeam'
      : 'freePlan.bodyGeneric'

  // Determine brand name and free photo count based on current domain
  const getBrandInfo = () => {
    const { brandName, isIndividual } = getClientBrandInfo()
    const credits = isIndividual ? PRICING_CONFIG.freeTrial.individual : PRICING_CONFIG.freeTrial.pro
    return {
      brandName,
      photoCount: Math.floor(credits / PRICING_CONFIG.credits.perGeneration)
    }
  }

  function handleUpgrade() {
    // Navigate to the prepared checkout/sign-up flow where the user can
    // choose Try-Out vs Subscription and Monthly vs Yearly.
    // personal -> individual tier, team -> team/pro tier
    const tier = variant === 'team' ? 'team' : 'individual'
    window.location.href = `/app/upgrade?tier=${encodeURIComponent(tier)}`
  }

  return (
    <div 
      data-testid="free-plan-banner" 
      className={`
        relative overflow-hidden rounded-2xl 
        bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50
        border-2 border-amber-200/60
        p-6 md:p-8
        shadow-lg shadow-amber-100/50
        ${className || ''}
      `}
    >
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-gradient-to-br from-yellow-200/30 to-amber-300/30 blur-2xl" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-gradient-to-tr from-orange-200/20 to-amber-200/20 blur-3xl" />
      
      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4 flex-1">
          {/* Icon with gradient background */}
          <div className="shrink-0 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl blur opacity-40" />
            <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <SparklesIcon className="h-7 w-7 text-white" strokeWidth={2} />
            </div>
          </div>
          
          {/* Text content */}
          <div className="space-y-2 flex-1">
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">
              {t('freePlan.title')}
            </h3>
            <p className="text-base text-gray-700 leading-relaxed max-w-2xl">
              {t(bodyKey, getBrandInfo())}
            </p>
          </div>
        </div>
        
        {/* CTA Button */}
        <button
          onClick={handleUpgrade}
          className="
            shrink-0 group
            inline-flex items-center gap-2
            px-6 py-3 rounded-xl
            bg-gradient-to-r from-amber-500 to-orange-600
            hover:from-amber-600 hover:to-orange-700
            text-white font-semibold
            shadow-lg shadow-amber-500/30
            hover:shadow-xl hover:shadow-orange-500/40
            transition-all duration-200
            hover:scale-105
            border border-amber-600/20
          "
        >
          {t('freePlan.cta')}
          <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

export default FreePlanBanner




'use client'

import { useTranslations } from 'next-intl'

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

  function handleUpgrade() {
    // Navigate to the prepared checkout/sign-up flow where the user can
    // choose Try-Out vs Subscription and Monthly vs Yearly.
    // personal -> individual tier, team -> team/pro tier
    const tier = variant === 'team' ? 'team' : 'individual'
    window.location.href = `/app/upgrade?tier=${encodeURIComponent(tier)}`
  }

  return (
    <div data-testid="free-plan-banner" className={`rounded-xl border border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 p-4 ${className || ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center shadow-inner">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-yellow-900 tracking-tight">{t('freePlan.title')}</p>
            <p className="text-yellow-800/90">{t(bodyKey)}</p>
          </div>
        </div>
        <button
          onClick={handleUpgrade}
          className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-yellow-600 text-white hover:bg-yellow-700 transition-colors text-sm font-medium shadow-sm"
        >
          {t('freePlan.cta')}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  )
}

export default FreePlanBanner



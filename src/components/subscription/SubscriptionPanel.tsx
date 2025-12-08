"use client"
import PricingCard from "@/components/pricing/PricingCard"
import TopUpCard from "@/components/pricing/TopUpCard"
import { CheckoutButton } from "@/components/ui"
import { PRICING_CONFIG } from "@/config/pricing"
import { InformationCircleIcon } from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"
import { getPricePerPhoto, formatPrice, calculatePhotosFromCredits } from "@/domain/pricing/utils"
import SubscriptionStatusBanner from "@/components/subscription/SubscriptionStatusBanner"
import { isFreePlan, PlanPeriod, PlanTier } from "@/domain/subscription/utils"
import { BRAND_CONFIG } from "@/config/brand"

// Using imported PlanPeriod and PlanTier from domain utils

export type SubscriptionSummary = {
  status?: string | null
  tier?: PlanTier
  period?: PlanPeriod
  nextRenewal?: string | null
  nextChange?: {
    action: 'start' | 'change' | 'cancel' | 'schedule'
    planTier: PlanTier
    planPeriod: Exclude<PlanPeriod, null>
    effectiveDate: string
  } | null
}

type UserMode = "user" | "team"

type Props = {
  subscription: SubscriptionSummary | null
  userMode: UserMode
  onCancel?: () => void
  onUpgrade?: (to: "pro") => void
  onDowngrade?: (to: "individual") => void
  onCheckoutError?: (message: string) => void
}

export default function SubscriptionPanel({ subscription, userMode, onCancel, onCheckoutError }: Props) {
  const t = useTranslations("app.settings.subscription")
  const tAll = useTranslations()
  const tPricing = useTranslations("pricing")

  const isActive = subscription?.status === "active"
  const currentTier = subscription?.tier
  const currentPeriod: PlanPeriod | null = subscription?.period || null
  const userIsFreePlan = isFreePlan(currentPeriod)
  const hasActiveSubscription = isActive && !userIsFreePlan
  const isCancelling = subscription?.nextChange?.action === 'cancel'
  // Deprecated subscription logic - simplified for transactional pricing
  const pendingPeriodChangeToMonthly = false
  const nextRenewalNote = hasActiveSubscription
    ? (isCancelling
        ? `Cancels on ${subscription?.nextChange?.effectiveDate ? new Date(subscription.nextChange.effectiveDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}`
        : pendingPeriodChangeToMonthly
        ? `Will downgrade to monthly on ${subscription?.nextChange?.effectiveDate ? new Date(subscription.nextChange.effectiveDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}`
        : (subscription?.nextRenewal
            ? `Renews on ${new Date(subscription.nextRenewal).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
            : 'Not available'))
    : undefined

  // const pricing = useMemo(() => getPricingDisplay(), []) // Disabled for transactional pricing

  // Build standardized plan objects (matching PricingPreview/PricingContent pattern)
  // Note: tryItForFree is automatically granted on signup, so it's not shown as a purchasable option

  const individualPlan = {
    id: 'individual' as const,
    price: `$${PRICING_CONFIG.individual.price}`,
    credits: PRICING_CONFIG.individual.credits,
    regenerations: PRICING_CONFIG.regenerations.individual,
    pricePerPhoto: formatPrice(getPricePerPhoto('individual')),
    totalPhotos: calculatePhotosFromCredits(PRICING_CONFIG.individual.credits) * (1 + PRICING_CONFIG.regenerations.individual),
    popular: userMode === 'user',
  }

  const proSmallPlan = {
    id: 'proSmall' as const,
    price: `$${PRICING_CONFIG.proSmall.price}`,
    credits: PRICING_CONFIG.proSmall.credits,
    regenerations: PRICING_CONFIG.regenerations.proSmall,
    pricePerPhoto: formatPrice(getPricePerPhoto('proSmall')),
    totalPhotos: calculatePhotosFromCredits(PRICING_CONFIG.proSmall.credits) * (1 + PRICING_CONFIG.regenerations.proSmall),
    popular: userMode === 'team',
  }

  const proLargePlan = {
    id: 'proLarge' as const,
    price: `$${PRICING_CONFIG.proLarge.price}`,
    credits: PRICING_CONFIG.proLarge.credits,
    regenerations: PRICING_CONFIG.regenerations.proLarge,
    pricePerPhoto: formatPrice(getPricePerPhoto('proLarge')),
    totalPhotos: calculatePhotosFromCredits(PRICING_CONFIG.proLarge.credits) * (1 + PRICING_CONFIG.regenerations.proLarge),
    popular: false,
  }

  const enterprisePlan = {
    id: 'enterprise' as const,
    price: `$${PRICING_CONFIG.enterprise.price}`,
    credits: PRICING_CONFIG.enterprise.credits,
    regenerations: PRICING_CONFIG.regenerations.enterprise,
    pricePerPhoto: formatPrice(getPricePerPhoto('enterprise')),
    totalPhotos: calculatePhotosFromCredits(PRICING_CONFIG.enterprise.credits) * (1 + PRICING_CONFIG.regenerations.enterprise),
    popular: false,
  }

  // Filter plans based on user mode
  const plansToShow = [
    // Show Individual if user mode, Pro Small, Pro Large, and Enterprise if team mode
    // tryItForFree is automatically granted on signup, not a purchasable option
    ...(userMode === 'team' ? [proSmallPlan, proLargePlan, enterprisePlan] : [individualPlan]),
  ]


  return (
    <div className="space-y-4">
      {userIsFreePlan ? (
        <div className="space-y-16">
          <SubscriptionStatusBanner
            title={tPricing('plans.free.name', { default: 'Free Plan' })}
            subtitle={tPricing('plans.free.description', { default: 'Upgrade to unlock more features' })}
          />

          <div className={`grid gap-8 ${
            plansToShow.length === 3 ? 'md:grid-cols-3' :
            plansToShow.length === 2 ? 'md:grid-cols-2' :
            'md:grid-cols-1'
          }`}>
            {plansToShow.map((plan) => {
              const checkoutType = 'plan'
              const stripePriceId = plan.id === 'proSmall'
                ? PRICING_CONFIG.proSmall.stripePriceId
                : plan.id === 'proLarge'
                  ? PRICING_CONFIG.proLarge.stripePriceId
                  : plan.id === 'enterprise'
                    ? PRICING_CONFIG.enterprise.stripePriceId
                    : PRICING_CONFIG.individual.stripePriceId

              return (
                <PricingCard
                  key={plan.id}
                  id={plan.id}
                  price={plan.price}
                  credits={plan.credits}
                  regenerations={plan.regenerations}
                  pricePerPhoto={plan.pricePerPhoto}
                  popular={plan.popular}
                  popularLabelKey={plan.popular ? "pricing.mostPopular" : undefined}
                  ctaSlot={
                    <CheckoutButton
                      loadingText={tAll("common.loading", { default: "Loading..." })}
                      type={checkoutType}
                      priceId={stripePriceId}
                      onError={onCheckoutError}
                      useBrandCtaColors={checkoutType === 'plan'}
                      fullWidth={checkoutType === 'plan'}
                    >
                      {tPricing(`plans.${plan.id}.cta`, { totalPhotos: plan.totalPhotos })}
                    </CheckoutButton>
                  }
                  className="h-full"
                />
              )
            })}
          </div>
        </div>
      ) : hasActiveSubscription ? (
        <div className="space-y-4">
          <SubscriptionStatusBanner
            title={`${currentTier === 'pro' && currentPeriod === 'small' ? 'Pro Small' : currentTier === 'pro' && currentPeriod === 'large' ? 'Pro Large' : currentTier === 'individual' ? 'Individual' : 'Free'} plan${isCancelling ? ' • Cancelling' : ''}`}
            subtitle={isCancelling 
              ? `${nextRenewalNote || '—'} • ${tPricing('photosRetainedAfterSubscription', { default: 'Photos retained while active + 30 days after' })}`
              : pendingPeriodChangeToMonthly
              ? (nextRenewalNote || '—')
              : `Next renewal: ${nextRenewalNote || 'Not available'}`}
            statusLabel={isCancelling ? 'Cancelling' : undefined}
            statusColor={isCancelling || pendingPeriodChangeToMonthly ? 'amber' : undefined}
          />

          {isCancelling && (
            <div className="bg-gradient-to-br from-brand-cta-light to-brand-cta-light border border-brand-cta/20 rounded-xl p-6">
              <div className="space-y-4">
                <p className="text-base leading-relaxed text-gray-800 font-medium">
                  {t('cancelling.sorryMessage', { default: "😭 We're sorry to see you go! Your benefits will remain active until the end of your billing period." })}
                </p>
                <p className="text-sm leading-relaxed text-gray-700">
                  {t('cancelling.photosRetained', { default: "Don't worry – your photos won't disappear! They'll hang around for 30 days after cancellation so you can grab what you need (because we're sentimental like that 📸)." })}
                </p>
                <p className="text-sm text-gray-600" dangerouslySetInnerHTML={{ 
                  __html: t('cancelling.changedMind', { 
                    default: "Changed your mind? {supportLink} keep your photos looking perfect!",
                    supportLink: `<a href="mailto:${BRAND_CONFIG.contact.support}" class="text-brand-primary hover:text-brand-primary-hover font-semibold underline transition-colors">${t('cancelling.supportLinkText', { default: "We're here to help" })}</a>`
                  })
                }} />
              </div>
            </div>
          )}

          {pendingPeriodChangeToMonthly && (
            <div className="bg-gradient-to-br from-brand-cta-light to-brand-cta-light border border-brand-cta/20 rounded-xl p-6">
              <div className="space-y-3">
                <p className="text-base leading-relaxed text-gray-800 font-medium">
                  {t('downgrading.note', { default: "📉 Switching to monthly? Your benefits remain active until the end of your annual period." })}
                </p>
                <p className="text-sm leading-relaxed text-gray-700">
                  {t('downgrading.noSavings', { default: "We won't judge (but we did try to warn you about missing out on those sweet savings 🍯)." })}
                </p>
                <p className="text-sm text-gray-600">
                  {t('downgrading.supportLinkText', { default: "Still wanna switch?" })} <a href={`mailto:${BRAND_CONFIG.contact.support}`} className="text-brand-primary hover:text-brand-primary-hover font-semibold underline transition-colors">{t('cancelling.supportLinkText', { default: "We're here to help" })}</a>
                </p>
              </div>
            </div>
          )}

          {/* Show top-up card for all active subscription states */}
          {(isCancelling || pendingPeriodChangeToMonthly) && (
            <div className="border border-gray-200 rounded-lg p-4">
              <TopUpCard tier={
                currentTier === "pro" && currentPeriod === "large" ? "proLarge" :
                currentTier === "pro" && currentPeriod === "small" ? "proSmall" :
                currentTier === "individual" ? "individual" :
                "individual" // Default fallback
              } onError={onCheckoutError} />
            </div>
          )}

          {/* Deprecated subscription upgrade/downgrade UI - removed for transactional pricing */}
          {onCancel && !isCancelling && (
            <button onClick={onCancel} className="w-full mt-6 px-4 py-3 text-sm font-medium text-red-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">Cancel Subscription</button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-brand-cta-light border border-brand-cta/20 text-brand-cta rounded-lg p-3">
            <InformationCircleIcon className="h-5 w-5 mt-0.5 text-brand-cta" />
            <p className="text-sm">{t("noSubscription", { default: "Choose a plan to get started and start looking amazing!" })}</p>
          </div>

          <div className={`grid gap-8 mt-6 ${
            plansToShow.length === 3 ? 'md:grid-cols-3' :
            plansToShow.length === 2 ? 'md:grid-cols-2' :
            'md:grid-cols-1'
          }`}>
            {plansToShow.map((plan) => {
              const checkoutType = 'plan'
              const stripePriceId = plan.id === 'proSmall'
                ? PRICING_CONFIG.proSmall.stripePriceId
                : plan.id === 'proLarge'
                  ? PRICING_CONFIG.proLarge.stripePriceId
                  : plan.id === 'enterprise'
                    ? PRICING_CONFIG.enterprise.stripePriceId
                    : PRICING_CONFIG.individual.stripePriceId

              return (
                <PricingCard
                  key={plan.id}
                  id={plan.id}
                  price={plan.price}
                  credits={plan.credits}
                  regenerations={plan.regenerations}
                  pricePerPhoto={plan.pricePerPhoto}
                  popular={plan.popular}
                  popularLabelKey={plan.popular ? "pricing.mostPopular" : undefined}
                  ctaSlot={
                    <CheckoutButton
                      loadingText={tAll("common.loading", { default: "Loading..." })}
                      type={checkoutType}
                      priceId={stripePriceId}
                      onError={onCheckoutError}
                      useBrandCtaColors={checkoutType === 'plan'}
                      fullWidth={checkoutType === 'plan'}
                    >
                      {tPricing(`plans.${plan.id}.cta`, { totalPhotos: plan.totalPhotos })}
                    </CheckoutButton>
                  }
                  className="h-full"
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}



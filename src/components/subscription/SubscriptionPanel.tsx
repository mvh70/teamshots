"use client"
import PricingCard from "@/components/pricing/PricingCard"
import TopUpCard from "@/components/pricing/TopUpCard"
import { CheckoutButton } from "@/components/ui"
import { PRICING_CONFIG } from "@/config/pricing"
import { InformationCircleIcon } from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"
import { getPricePerPhoto, formatPrice } from "@/domain/pricing/utils"
import SubscriptionStatusBanner from "@/components/subscription/SubscriptionStatusBanner"
import { isFreePlan, PlanPeriod, PlanTier } from "@/domain/subscription/utils"
import { getBrandContact } from "@/config/brand"

// Using imported PlanPeriod and PlanTier from domain utils

export type SubscriptionSummary = {
  status?: string | null
  tier?: PlanTier
  period?: PlanPeriod
  nextRenewal?: string | null
  nextChange?: {
    action: 'start' | 'change' | 'cancel' | 'schedule'
    planTier: PlanTier
    planPeriod: Exclude<PlanPeriod, 'free' | 'tryOnce' | null>
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
  const currentPeriod: PlanPeriod = subscription?.period || null
  const isTryOnce = currentPeriod === "tryOnce"
  const userIsFreePlan = isFreePlan(currentPeriod)
  const hasActiveSubscription = isActive && !userIsFreePlan && !isTryOnce
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
  const tryOncePlan = {
    id: 'tryOnce' as const,
    price: `$${PRICING_CONFIG.tryOnce.price}`,
    credits: PRICING_CONFIG.tryOnce.credits,
    regenerations: PRICING_CONFIG.regenerations.tryOnce,
    pricePerPhoto: formatPrice(getPricePerPhoto('tryOnce')),
    popular: false,
  }

  const individualPlan = {
    id: 'individual' as const,
    price: `$${PRICING_CONFIG.individual.price}`,
    credits: PRICING_CONFIG.individual.credits,
    regenerations: PRICING_CONFIG.regenerations.individual,
    pricePerPhoto: formatPrice(getPricePerPhoto('individual')),
    popular: userMode === 'user',
  }

  const proSmallPlan = {
    id: 'proSmall' as const,
    price: `$${PRICING_CONFIG.proSmall.price}`,
    credits: PRICING_CONFIG.proSmall.credits,
    regenerations: PRICING_CONFIG.regenerations.proSmall,
    pricePerPhoto: formatPrice(getPricePerPhoto('proSmall')),
    popular: userMode === 'team',
  }

  const proLargePlan = {
    id: 'proLarge' as const,
    price: `$${PRICING_CONFIG.proLarge.price}`,
    credits: PRICING_CONFIG.proLarge.credits,
    regenerations: PRICING_CONFIG.regenerations.proLarge,
    pricePerPhoto: formatPrice(getPricePerPhoto('proLarge')),
    popular: false,
  }

  // Filter plans based on user mode
  const plansToShow = [
    // Always show Try Once
    tryOncePlan,
    // Show Individual if user mode, Pro Small and Pro Large if team mode
    ...(userMode === 'team' ? [proSmallPlan, proLargePlan] : [individualPlan]),
  ]


  return (
    <div className="space-y-4">
      {isTryOnce ? (
        <div className="space-y-4">
          <SubscriptionStatusBanner
            title={`${currentTier === 'pro' ? tPricing('plans.pro.name', { default: 'Pro' }) : tPricing('plans.individual.name', { default: 'Individual' })} • ${tPricing('plans.tryOnce.name', { default: 'Try Once' })}`}
            subtitle={tPricing('plans.tryOnce.description', { default: 'One-time purchase' })}
          />

          {/* Billing toggle hidden - now transactional pricing only */}
          {/* <div className="flex items-center justify-center mb-6">
            <BillingToggle isYearly={isYearly} onChange={setIsYearly} />
          </div> */}
          <br />

          <div className="grid md:grid-cols-2 gap-8 mt-2">
            <div>
              <PricingCard
                id="individual"
                titleOverride={tAll("app.settings.subscription.plan.individual", { default: "Individual subscription" })}
                price={`$${PRICING_CONFIG.individual.price}`}
                credits={PRICING_CONFIG.individual.credits}
                regenerations={PRICING_CONFIG.regenerations.individual}
                popular
                ctaSlot={
                  <CheckoutButton
                    loadingText={tAll("common.loading", { default: "Loading..." })}
                    type="plan"
                    priceId={PRICING_CONFIG.individual.stripePriceId}
                    onError={onCheckoutError}
                    fullWidth
                    useBrandCtaColors
                  >
                    {tPricing("plans.individual.cta")}
                  </CheckoutButton>
                }
                popularLabelKey="pricingPreview.recommended"
                className="h-full"
              />
            </div>
            <TopUpCard tier="try_once" onError={onCheckoutError} regenerationsOverride={PRICING_CONFIG.regenerations.tryOnce} />
          </div>
        </div>
      ) : hasActiveSubscription ? (
        <div className="space-y-4">
          <SubscriptionStatusBanner
            title={`${(currentTier === 'pro' || currentTier === 'proSmall') ? 'Pro Small' : currentTier === 'proLarge' ? 'Pro Large' : 'Individual'} plan${isCancelling ? ' • Cancelling' : ''}`}
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
                    supportLink: `<a href="mailto:${getBrandContact().support}" class="text-brand-primary hover:text-brand-primary-hover font-semibold underline transition-colors">${t('cancelling.supportLinkText', { default: "We're here to help" })}</a>`
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
                  {t('downgrading.supportLinkText', { default: "Still wanna switch?" })} <a href={`mailto:${getBrandContact().support}`} className="text-brand-primary hover:text-brand-primary-hover font-semibold underline transition-colors">{t('cancelling.supportLinkText', { default: "We're here to help" })}</a>
                </p>
              </div>
            </div>
          )}

          {/* Show top-up card for all active subscription states */}
          {(isCancelling || pendingPeriodChangeToMonthly) && (
            <div className="border border-gray-200 rounded-lg p-4">
              <TopUpCard tier={(currentTier === "pro" || currentTier === "proSmall") ? "proSmall" : currentTier === "proLarge" ? "proLarge" : "individual"} onError={onCheckoutError} />
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
              const checkoutType = plan.id === 'tryOnce' ? 'try_once' : 'plan'
              const stripePriceId = plan.id === 'tryOnce' 
                ? PRICING_CONFIG.tryOnce.stripePriceId
                : plan.id === 'proSmall'
                  ? PRICING_CONFIG.proSmall.stripePriceId
                  : plan.id === 'proLarge'
                    ? PRICING_CONFIG.proLarge.stripePriceId
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
                  popularLabelKey={plan.popular ? "pricingPreview.recommended" : undefined}
                  ctaSlot={
                    <CheckoutButton
                      loadingText={tAll("common.loading", { default: "Loading..." })}
                      type={checkoutType}
                      priceId={stripePriceId}
                      onError={onCheckoutError}
                      useBrandCtaColors={checkoutType === 'plan'}
                      fullWidth={checkoutType === 'plan'}
                    >
                      {tPricing(`plans.${plan.id}.cta`)}
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



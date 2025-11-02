"use client"

import { useMemo, useState } from "react"
import BillingToggle from "@/components/pricing/BillingToggle"
import PricingCard from "@/components/pricing/PricingCard"
import TopUpCard from "@/components/pricing/TopUpCard"
import CheckoutButton from "@/components/pricing/CheckoutButton"
import { PRICING_CONFIG } from "@/config/pricing"
import { InformationCircleIcon } from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"
import { getPricingDisplay, formatPrice } from "@/domain/pricing/utils"
import SubscriptionStatusBanner from "@/components/subscription/SubscriptionStatusBanner"
import { isFreePlan } from "@/domain/subscription/utils"

type PlanPeriod = "free" | "try_once" | "monthly" | "annual" | null

export type SubscriptionSummary = {
  status?: string | null
  tier?: "individual" | "pro" | null
  period?: PlanPeriod
  nextRenewal?: string | null
  nextChange?: {
    action: 'start' | 'change' | 'cancel' | 'schedule'
    planTier: 'individual' | 'pro'
    planPeriod: Exclude<PlanPeriod, 'free' | 'try_once' | null>
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

  const [isYearly, setIsYearly] = useState(false)
  const [processing, setProcessing] = useState(false)

  const isActive = subscription?.status === "active"
  const currentTier = subscription?.tier
  const currentPeriod: PlanPeriod = subscription?.period || null
  const isTryOnce = currentPeriod === "try_once"
  const userIsFreePlan = isFreePlan(currentPeriod)
  const hasActiveSubscription = isActive && !userIsFreePlan && !isTryOnce
  const isCancelling = subscription?.nextChange?.action === 'cancel'
  const pendingPeriodChangeToMonthly = (
    subscription?.nextChange?.action === 'schedule' &&
    subscription?.nextChange?.planPeriod === 'monthly' &&
    currentPeriod === 'annual'
  )
  const nextRenewalNote = hasActiveSubscription
    ? (isCancelling
        ? `Cancels on ${subscription?.nextChange?.effectiveDate ? new Date(subscription.nextChange.effectiveDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}`
        : pendingPeriodChangeToMonthly
        ? `Will downgrade to monthly on ${subscription?.nextChange?.effectiveDate ? new Date(subscription.nextChange.effectiveDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}`
        : (subscription?.nextRenewal
            ? `Renews on ${new Date(subscription.nextRenewal).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
            : 'Not available'))
    : undefined

  const pricing = useMemo(() => getPricingDisplay(), [])

  const previousMonthlyFromAnnualText = currentTier === "pro"
    ? formatPrice(PRICING_CONFIG.pro.annual.price / 12)
    : formatPrice(PRICING_CONFIG.individual.annual.price / 12)

  const schedulePeriodChange = async (target: 'monthly' | 'annual') => {
    try {
      setProcessing(true)
      const res = await fetch('/api/stripe/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPeriod: target }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to schedule change')
      alert(data?.message || 'Change scheduled')
    } catch (e) {
      if (onCheckoutError) onCheckoutError(e instanceof Error ? e.message : String(e))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      {isTryOnce ? (
        <div className="space-y-4">
          <SubscriptionStatusBanner
            title={`${currentTier === 'pro' ? tPricing('plans.pro.name', { default: 'Pro' }) : tPricing('plans.individual.name', { default: 'Individual' })} • ${tPricing('plans.tryOnce.name', { default: 'Try Once' })}`}
            subtitle={tPricing('plans.tryOnce.description', { default: 'One-time purchase' })}
          />

          <div className="flex items-center justify-center mb-6">
            <BillingToggle isYearly={isYearly} onChange={setIsYearly} />
          </div>
          <br />

          <div className="grid md:grid-cols-2 gap-8 mt-2">
            <div>
              <PricingCard
                id="individual"
                titleOverride={tAll("app.settings.subscription.plan.individual", { default: "Individual subscription" })}
                price={pricing.individual.monthly.price}
                yearlyPrice={pricing.individual.annual.price}
                credits={pricing.individual.monthly.credits}
                monthlyPricePerPhoto={pricing.individual.monthly.pricePerPhoto}
                yearlyPricePerPhoto={pricing.individual.annual.pricePerPhoto}
                regenerations={pricing.individual.monthly.regenerations}
                annualSavings={pricing.individual.annual.savings}
                popular
                isYearly={isYearly}
                ctaSlot={
                  <CheckoutButton
                    label={tPricing("plans.individual.cta")}
                    loadingLabel={tAll("common.loading", { default: "Loading..." })}
                    type="subscription"
                    priceId={isYearly ? PRICING_CONFIG.individual.annual.stripePriceId : PRICING_CONFIG.individual.monthly.stripePriceId}
                    onError={onCheckoutError}
                  />
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
            title={`${currentTier === 'pro' ? tPricing('plans.pro.name', { default: 'Pro' }) : tPricing('plans.individual.name', { default: 'Individual' })} ${currentPeriod === 'annual' ? 'yearly' : 'monthly'}${isCancelling ? ' • Cancelling' : ''}`}
            subtitle={isCancelling 
              ? `${nextRenewalNote || '—'} • ${tPricing('photosRetainedAfterSubscription', { default: 'Photos retained while active + 30 days after' })}`
              : pendingPeriodChangeToMonthly
              ? (nextRenewalNote || '—')
              : `Next renewal: ${nextRenewalNote || 'Not available'}`}
            statusLabel={isCancelling ? 'Cancelling' : undefined}
            statusColor={isCancelling || pendingPeriodChangeToMonthly ? 'amber' : undefined}
          />

          {isCancelling && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6">
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
                    supportLink: `<a href="mailto:support@teamshots.com" class="text-blue-600 hover:text-blue-700 font-semibold underline transition-colors">${t('cancelling.supportLinkText', { default: "We're here to help" })}</a>`
                  })
                }} />
              </div>
            </div>
          )}

          {pendingPeriodChangeToMonthly && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6">
              <div className="space-y-3">
                <p className="text-base leading-relaxed text-gray-800 font-medium">
                  {t('downgrading.note', { default: "📉 Switching to monthly? Your benefits remain active until the end of your annual period." })}
                </p>
                <p className="text-sm leading-relaxed text-gray-700">
                  {t('downgrading.noSavings', { default: "We won't judge (but we did try to warn you about missing out on those sweet savings 🍯)." })}
                </p>
                <p className="text-sm text-gray-600">
                  {t('downgrading.supportLinkText', { default: "Still wanna switch?" })} <a href="mailto:support@teamshots.com" className="text-blue-600 hover:text-blue-700 font-semibold underline transition-colors">{t('cancelling.supportLinkText', { default: "We're here to help" })}</a>
                </p>
              </div>
            </div>
          )}

          {/* Show top-up card for all active subscription states */}
          {(isCancelling || pendingPeriodChangeToMonthly) && (
            <div className="border border-gray-200 rounded-lg p-4">
              <TopUpCard tier={currentTier === "pro" ? "pro" : "individual"} onError={onCheckoutError} />
            </div>
          )}

          {!isCancelling && !pendingPeriodChangeToMonthly && (
          <div className="border border-gray-200 rounded-lg p-4">
            {currentPeriod === "monthly" ? (
              <div className="grid md:grid-cols-2 gap-8 mb-6">
                <PricingCard
                  id={currentTier === "pro" ? "pro" : "individual"}
                  titleOverride={`Change to ${currentTier === "pro" ? tPricing("plans.pro.name", { default: "Pro" }) : tPricing("plans.individual.name", { default: "Individual" })} yearly`}
                  price={currentTier === "pro" ? pricing.pro.monthly.price : pricing.individual.monthly.price}
                  yearlyPrice={currentTier === "pro" ? pricing.pro.annual.price : pricing.individual.annual.price}
                  previousPrice={currentTier === "pro" ? pricing.pro.monthly.price : pricing.individual.monthly.price}
                  credits={currentTier === "pro" ? pricing.pro.monthly.credits : pricing.individual.monthly.credits}
                  monthlyPricePerPhoto={currentTier === "pro" ? pricing.pro.monthly.pricePerPhoto : pricing.individual.monthly.pricePerPhoto}
                  yearlyPricePerPhoto={currentTier === "pro" ? pricing.pro.annual.pricePerPhoto : pricing.individual.annual.pricePerPhoto}
                  regenerations={currentTier === "pro" ? pricing.pro.monthly.regenerations : pricing.individual.monthly.regenerations}
                  annualSavings={currentTier === "pro" ? pricing.pro.annual.savings : pricing.individual.annual.savings}
                  popular
                  isYearly={true}
                  ctaSlot={
                    <CheckoutButton
                      label={tPricing("actions.upgradeToYearly", { default: "Switch to yearly" })}
                      loadingLabel={tAll("common.loading", { default: "Loading..." })}
                      type="subscription"
                      priceId={currentTier === "pro" ? PRICING_CONFIG.pro.annual.stripePriceId : PRICING_CONFIG.individual.annual.stripePriceId}
                      onError={onCheckoutError}
                    />
                  }
                  popularLabelKey="pricingPreview.recommended"
                />
                <TopUpCard tier={currentTier === "pro" ? "pro" : "individual"} onError={onCheckoutError} />
              </div>
            ) : (
              currentPeriod === "annual" && (
                <div className="grid md:grid-cols-2 gap-8 mb-6">
                  {pendingPeriodChangeToMonthly ? (
                    <></>
                  ) : (
                    <PricingCard
                      id={currentTier === "pro" ? "pro" : "individual"}
                      titleOverride={t('downgrade.title', { 
                        tier: currentTier === "pro" ? tPricing("plans.pro.name", { default: "Pro" }) : tPricing("plans.individual.name", { default: "Individual" }),
                        default: "Downgrade to {tier} monthly? 🤔" 
                      })}
                      descriptionOverride={t('downgrade.description', { 
                        default: "The path less traveled... but with fewer savings! 🗺️" 
                      })}
                      price={currentTier === "pro" ? pricing.pro.monthly.price : pricing.individual.monthly.price}
                      yearlyPrice={currentTier === "pro" ? pricing.pro.annual.price : pricing.individual.annual.price}
                      previousPrice={previousMonthlyFromAnnualText}
                      credits={currentTier === "pro" ? pricing.pro.monthly.credits : pricing.individual.monthly.credits}
                      monthlyPricePerPhoto={currentTier === "pro" ? pricing.pro.monthly.pricePerPhoto : pricing.individual.monthly.pricePerPhoto}
                      yearlyPricePerPhoto={currentTier === "pro" ? pricing.pro.annual.pricePerPhoto : pricing.individual.annual.pricePerPhoto}
                      regenerations={currentTier === "pro" ? pricing.pro.monthly.regenerations : pricing.individual.monthly.regenerations}
                      annualSavings={currentTier === "pro" ? pricing.pro.annual.savings : pricing.individual.annual.savings}
                      isYearly={false}
                      ctaSlot={
                        <button
                          onClick={() => schedulePeriodChange('monthly')}
                          disabled={processing}
                          className={`w-full px-4 py-3 rounded-md text-sm font-semibold text-white ${processing ? 'opacity-60 cursor-not-allowed' : ''} bg-red-600 hover:bg-red-700`}
                        >
                          <div className="flex flex-col items-center leading-tight">
                            <span>{t('downgrade.button', { default: 'Proceed anyway (we tried!) 😅' })}</span>
                            <span className="text-[11px] opacity-90 mt-0.5">{tPricing('actions.effectiveOn', { date: (subscription?.nextRenewal ? new Date(subscription.nextRenewal).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'), default: `Effective on ${subscription?.nextRenewal ? new Date(subscription.nextRenewal).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}` })}</span>
                          </div>
                        </button>
                      }
                    />
                  )}
                  <TopUpCard tier={currentTier === "pro" ? "pro" : "individual"} onError={onCheckoutError} />
                </div>
              )
            )}
          </div>
          )}
          {onCancel && !isCancelling && (
            <button onClick={onCancel} className="w-full mt-6 px-4 py-3 text-sm font-medium text-red-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">Cancel Subscription</button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3">
            <InformationCircleIcon className="h-5 w-5 mt-0.5 text-amber-600" />
            <p className="text-sm">{t("noSubscription", { default: "You don't have an active subscription" })}</p>
          </div>

          <div className="flex items-center justify-center mb-6">
            <BillingToggle isYearly={isYearly} onChange={setIsYearly} />
          </div>

          <div className="grid md:grid-cols-2 gap-8 mt-6">
            <PricingCard
              id="tryOnce"
              price={pricing.tryOnce.price}
              credits={pricing.tryOnce.credits}
              pricePerPhoto={pricing.tryOnce.pricePerPhoto}
              regenerations={pricing.tryOnce.regenerations}
              isYearly={false}
              ctaSlot={
                <CheckoutButton
                  label={tPricing("plans.tryOnce.cta")}
                  loadingLabel={tAll("common.loading", { default: "Loading..." })}
                  type="try_once"
                  priceId={PRICING_CONFIG.tryOnce.stripePriceId}
                  onError={onCheckoutError}
                />
              }
              className="h-full"
            />

            <PricingCard
              id={userMode === "team" ? "pro" : "individual"}
              price={userMode === "team" ? pricing.pro.monthly.price : pricing.individual.monthly.price}
              yearlyPrice={userMode === "team" ? pricing.pro.annual.price : pricing.individual.annual.price}
              credits={userMode === "team" ? pricing.pro.monthly.credits : pricing.individual.monthly.credits}
              monthlyPricePerPhoto={userMode === "team" ? pricing.pro.monthly.pricePerPhoto : pricing.individual.monthly.pricePerPhoto}
              yearlyPricePerPhoto={userMode === "team" ? pricing.pro.annual.pricePerPhoto : pricing.individual.annual.pricePerPhoto}
              regenerations={userMode === "team" ? pricing.pro.monthly.regenerations : pricing.individual.monthly.regenerations}
              annualSavings={userMode === "team" ? pricing.pro.annual.savings : pricing.individual.annual.savings}
              popular
              isYearly={isYearly}
              ctaSlot={
                <CheckoutButton
                  label={userMode === "team" ? tPricing("plans.pro.cta") : tPricing("plans.individual.cta")}
                  loadingLabel={tAll("common.loading", { default: "Loading..." })}
                  type="subscription"
                  priceId={isYearly ? (userMode === "team" ? PRICING_CONFIG.pro.annual.stripePriceId : PRICING_CONFIG.individual.annual.stripePriceId) : (userMode === "team" ? PRICING_CONFIG.pro.monthly.stripePriceId : PRICING_CONFIG.individual.monthly.stripePriceId)}
                  onError={onCheckoutError}
                />
              }
              popularLabelKey="pricingPreview.recommended"
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}



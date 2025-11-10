import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { PRICING_CONFIG } from '@/config/pricing'
import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'


export const runtime = 'nodejs'
const stripe = new Stripe(Env.string('STRIPE_SECRET_KEY'), {
  apiVersion: '2025-10-29.clover',
})

// Cancel subscription at period end (schedule)
export async function DELETE() {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeSubscriptionId: true },
    })

    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    // Retrieve subscription to compute effective end date
    const subscription = (await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId
    )) as Stripe.Subscription

    // Determine current tier and period by matching price ID to config (same logic as PATCH)
    const currentPriceId = subscription.items.data[0]?.price?.id
    const currentTier: 'individual' | 'pro' =
      currentPriceId === PRICING_CONFIG.pro.monthly.stripePriceId || currentPriceId === PRICING_CONFIG.pro.annual.stripePriceId
        ? 'pro'
        : 'individual'
    const currentPlanPeriod: 'monthly' | 'annual' =
      currentPriceId === PRICING_CONFIG.individual.annual.stripePriceId || currentPriceId === PRICING_CONFIG.pro.annual.stripePriceId
        ? 'annual'
        : 'monthly'

    // Determine contract end (same logic as period change):
    // 1) Prefer ledger: latest annual start/change effectiveDate + 1 year
    // 2) Else subscription.metadata.contract_end if present
    // 3) Else subscription.start_date + 12 months (for annual) or current_period_end (for monthly)
    let contractEndTs: number | undefined
    const fallbackNow = Math.floor(Date.now() / 1000)
    try {
      const ledgerClient = prisma as unknown as { subscriptionChange: { findFirst: (args: unknown) => Promise<unknown> } }
      const latestAnnual = await ledgerClient.subscriptionChange.findFirst({
        where: {
          userId: session.user.id,
          planPeriod: 'annual',
          action: { in: ['start', 'change'] },
          effectiveDate: { lte: new Date() },
        },
        orderBy: { effectiveDate: 'desc' },
      }) as unknown as { effectiveDate?: Date } | null
      if (latestAnnual?.effectiveDate && currentPlanPeriod === 'annual') {
        const startMs = latestAnnual.effectiveDate.getTime()
        contractEndTs = Math.floor(new Date(new Date(startMs).setFullYear(new Date(startMs).getFullYear() + 1)).getTime() / 1000)
      }
    } catch {}
    if (!contractEndTs) {
      const subMetaContractEnd = (subscription.metadata?.contract_end as string | undefined) || undefined
      if (subMetaContractEnd) {
        const ts = Math.floor(new Date(subMetaContractEnd).getTime() / 1000)
        if (!Number.isNaN(ts) && ts > fallbackNow) contractEndTs = ts
      }
    }
    if (!contractEndTs) {
      if (currentPlanPeriod === 'annual') {
        const startTs = (subscription as unknown as { start_date?: number }).start_date || fallbackNow
        contractEndTs = Math.floor(new Date(startTs * 1000).setFullYear(new Date(startTs * 1000).getFullYear() + 1) / 1000)
      } else {
        contractEndTs = (subscription as unknown as { current_period_end?: number }).current_period_end || fallbackNow
      }
    }
    
    Logger.info('Subscription cancellation - contract end calculation', {
      userId: session.user.id,
      currentPlanPeriod,
      contractEndTs,
      contractEndDate: contractEndTs ? new Date(contractEndTs * 1000).toISOString() : null,
      currentPeriodEnd: (subscription as unknown as { current_period_end?: number }).current_period_end,
      subscriptionMetadata: subscription.metadata,
      now: new Date().toISOString()
    })

    // Schedule cancel at period end
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    // Record a scheduled cancellation in our ledger
    try {
      const prismaEx = prisma as unknown as { subscriptionChange: { create: (args: unknown) => Promise<unknown> } }
      await prismaEx.subscriptionChange.create({
        data: {
          userId: session.user.id,
          planTier: currentTier,
          planPeriod: currentPlanPeriod,
          action: 'cancel',
          effectiveDate: new Date((contractEndTs as number) * 1000),
          stripeSubscriptionId: subscription.id,
          metadata: { reason: 'user_requested_cancel_at_period_end' },
        }
      })
      Logger.info('Subscription cancellation recorded in ledger', { userId: session.user.id, effectiveDate: new Date((contractEndTs as number) * 1000).toISOString() })
    } catch (error) {
      Logger.error('Failed to record cancellation in ledger', { error: error instanceof Error ? error.message : String(error), userId: session.user.id })
    }

    return NextResponse.json({ 
      message: 'Subscription cancellation scheduled for period end',
      effectiveDate: new Date((contractEndTs as number) * 1000).toISOString(),
    })
  } catch (error) {
    Logger.error('Error cancelling subscription', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
  }
}

// Modify subscription (upgrade/downgrade)
export async function PATCH(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { newTier, newPeriod } = body as { newTier?: 'individual' | 'pro'; newPeriod?: 'monthly' | 'annual' }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        stripeSubscriptionId: true,
      },
    })

    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    // Determine the new price ID based on the tier
    // Retrieve current subscription
    const subscription = (await stripe.subscriptions.retrieve(user.stripeSubscriptionId)) as Stripe.Subscription
    const fallbackNow = Math.floor(Date.now() / 1000)
    // Determine annual term end (contract end):
    // 1) Prefer ledger: latest annual start/change effectiveDate + 1 year
    // 2) Else subscription.metadata.contract_end if present
    // 3) Else subscription.start_date + 12 months
    let contractEndTs: number | undefined
    try {
      const ledgerClient = prisma as unknown as { subscriptionChange: { findFirst: (args: unknown) => Promise<unknown> } }
      const latestAnnual = await ledgerClient.subscriptionChange.findFirst({
        where: {
          userId: session.user.id,
          planPeriod: 'annual',
          action: { in: ['start', 'change'] },
          effectiveDate: { lte: new Date() },
        },
        orderBy: { effectiveDate: 'desc' },
      }) as unknown as { effectiveDate?: Date } | null
      if (latestAnnual?.effectiveDate) {
        const startMs = latestAnnual.effectiveDate.getTime()
        contractEndTs = Math.floor(new Date(new Date(startMs).setFullYear(new Date(startMs).getFullYear() + 1)).getTime() / 1000)
      }
    } catch {}
    if (!contractEndTs) {
      const subMetaContractEnd = (subscription.metadata?.contract_end as string | undefined) || undefined
      if (subMetaContractEnd) {
        const ts = Math.floor(new Date(subMetaContractEnd).getTime() / 1000)
        if (!Number.isNaN(ts) && ts > fallbackNow) contractEndTs = ts
      }
    }

    // Handle period change scheduling at period end
    if (newPeriod && (newPeriod === 'monthly' || newPeriod === 'annual')) {
      const targetIsMonthly = newPeriod === 'monthly'
      // Determine current tier by matching current price ID to our config (never infer from Stripe product name)
      const currentPriceId = subscription.items.data[0]?.price?.id
      const currentTier: 'individual' | 'pro' =
        currentPriceId === PRICING_CONFIG.pro.monthly.stripePriceId || currentPriceId === PRICING_CONFIG.pro.annual.stripePriceId
          ? 'pro'
          : 'individual'
      const targetPriceId = currentTier === 'pro'
        ? (targetIsMonthly ? PRICING_CONFIG.pro.monthly.stripePriceId : PRICING_CONFIG.pro.annual.stripePriceId)
        : (targetIsMonthly ? PRICING_CONFIG.individual.monthly.stripePriceId : PRICING_CONFIG.individual.annual.stripePriceId)

      // Create or update a schedule effective at contract end
      // Create schedule from existing subscription, then update phases separately
      const scheduleCreated = await stripe.subscriptionSchedules.create({
        from_subscription: subscription.id,
      })
      // Retrieve schedule (to know the current phase start), then rebuild phases so:
      // - Phase 0: current price from current phase start → contractEndTs
      // - Phase 1: target price from contractEndTs → (open ended until release)
      const existing = await stripe.subscriptionSchedules.retrieve(scheduleCreated.id)
      const nowTs = Math.floor(Date.now() / 1000)
      const currentPhase = existing.phases?.find(ph => {
        const s = (ph as unknown as { start_date?: number }).start_date || 0
        const e = (ph as unknown as { end_date?: number | null }).end_date || Number.POSITIVE_INFINITY
        return s <= nowTs && nowTs < e
      })
      const phase0Start = (currentPhase as unknown as { start_date?: number })?.start_date || (subscription as unknown as { current_period_start?: number }).current_period_start || nowTs
      // If contract_end still not known, compute 12 months from subscription start
      if (!contractEndTs) {
        const startTs = (subscription as unknown as { start_date?: number }).start_date || nowTs
        const plus12Months = Math.floor(new Date(startTs * 1000).setFullYear(new Date(startTs * 1000).getFullYear() + 1) / 1000)
        contractEndTs = plus12Months
      }
      const schedule = await stripe.subscriptionSchedules.update(scheduleCreated.id, {
        end_behavior: 'release',
        phases: [
          {
            start_date: phase0Start,
            end_date: contractEndTs as number,
            items: [{ price: subscription.items.data[0].price.id }],
          },
          {
            start_date: contractEndTs as number,
            items: [{ price: targetPriceId }],
          },
        ],
      })

      // Record schedule in our ledger
      try {
        const prismaEx = prisma as unknown as { subscriptionChange: { create: (args: unknown) => Promise<unknown> } }
        await prismaEx.subscriptionChange.create({
          data: {
            userId: session.user.id,
            planTier: currentTier,
            planPeriod: newPeriod,
            action: 'schedule',
            effectiveDate: new Date((contractEndTs as number) * 1000),
            stripeSubscriptionId: subscription.id,
            stripeScheduleId: schedule.id,
            metadata: { reason: 'user_requested_period_change' },
          },
        })
      } catch {}

      return NextResponse.json({
        message: 'Subscription change scheduled for period end',
        effectiveDate: new Date((contractEndTs as number) * 1000).toISOString(),
      })
    }

    if (!newTier || !['individual', 'pro'].includes(newTier)) {
      return NextResponse.json({ error: 'Invalid change specified' }, { status: 400 })
    }

    const newPriceId = newTier === 'individual'
      ? PRICING_CONFIG.individual.monthly.stripePriceId
      : PRICING_CONFIG.pro.monthly.stripePriceId

    // Update the subscription to the new price immediately (tier change)
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations',
    })

    return NextResponse.json({ message: 'Subscription updated successfully', tier: newTier })
  } catch (error) {
    Logger.error('Error updating subscription', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}

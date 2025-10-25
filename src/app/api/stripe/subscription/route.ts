import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { PRICING_CONFIG } from '@/config/pricing'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
})

// Cancel subscription
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

    // Cancel the subscription immediately
    await stripe.subscriptions.cancel(user.stripeSubscriptionId)

    return NextResponse.json({ message: 'Subscription cancelled successfully' })
  } catch (error) {
    console.error('Error cancelling subscription:', error)
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
    const { newTier } = body

    if (!newTier || !['individual', 'pro'].includes(newTier)) {
      return NextResponse.json({ error: 'Invalid tier specified' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionTier: true,
        stripeSubscriptionId: true,
      },
    })

    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    // Determine the new price ID based on the tier
    const newPriceId = newTier === 'individual'
      ? PRICING_CONFIG.individual.monthly.stripePriceId
      : PRICING_CONFIG.pro.monthly.stripePriceId

    // Retrieve current subscription
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)

    // Update the subscription to the new price
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations', // Prorate the difference
    })

    return NextResponse.json({ message: 'Subscription updated successfully', tier: newTier })
  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}

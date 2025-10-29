import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Env } from '@/lib/env'

const stripe = new Stripe(Env.string('STRIPE_SECRET_KEY', ''), {
  apiVersion: '2025-09-30.clover',
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subscriptionId, newPriceId }: { subscriptionId: string; newPriceId: string } = await request.json()
    if (!subscriptionId || !newPriceId) return NextResponse.json({ error: 'Missing subscriptionId or newPriceId' }, { status: 400 })

    // Verify ownership (optional, light check via customer)
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || !user.stripeCustomerId) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    if (customerId !== user.stripeCustomerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'always_invoice',
    })

    return NextResponse.json({ subscriptionId: updated.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}



import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Env } from '@/lib/env'


export const runtime = 'nodejs'
const stripe = new Stripe(Env.string('STRIPE_SECRET_KEY', ''), {
  apiVersion: '2025-10-29.clover',
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, tier, period }: { priceId?: string; tier?: 'individual' | 'pro'; period?: 'monthly' | 'annual' } = await request.json()

    if (!priceId || !tier || !period) {
      return NextResponse.json({ error: 'Missing priceId, tier or period' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Ensure Stripe customer exists
    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } })
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } })
      customerId = customer.id
    }

    if (period === 'annual') {
      const now = new Date()
      const contractEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      const schedule = await stripe.subscriptionSchedules.create({
        customer: customerId,
        start_date: 'now',
        end_behavior: 'release',
        phases: [
          {
            items: [{ price: priceId, quantity: 1 }],
            end_date: Math.floor(contractEnd.getTime() / 1000),
          },
        ],
        metadata: {
          contract_type: 'annual',
          contract_start: now.toISOString(),
          contract_end: contractEnd.toISOString(),
          tier,
        },
      })

      return NextResponse.json({ scheduleId: schedule.id })
    }

    // Fallback: regular monthly subscription (no schedule)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: { userId: user.id, tier, period: 'monthly' },
    })

    return NextResponse.json({ subscriptionId: subscription.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}



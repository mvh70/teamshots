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
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subscriptionId, newLowerPriceId }: { subscriptionId: string; newLowerPriceId: string } = await request.json()
    if (!subscriptionId || !newLowerPriceId) return NextResponse.json({ error: 'Missing subscriptionId or newLowerPriceId' }, { status: 400 })

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || !user.stripeCustomerId) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    if (customerId !== user.stripeCustomerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Check contract end from metadata or schedule
    const contractEnd = subscription.metadata?.contract_end
    const now = new Date()
    const inContract = contractEnd ? new Date(contractEnd) > now : false

    if (inContract) {
      // Ensure a schedule exists
      const schedule = subscription.schedule
        ? await stripe.subscriptionSchedules.retrieve(subscription.schedule as string)
        : await stripe.subscriptionSchedules.create({ from_subscription: subscription.id })

      const currentPriceId = subscription.items.data[0].price?.id as string

      const phases = [
        {
          items: [{ price: currentPriceId, quantity: 1 }],
          end_date: Math.floor(new Date(contractEnd as string).getTime() / 1000),
        },
        {
          items: [{ price: newLowerPriceId, quantity: 1 }],
        },
      ]

      const updatedSchedule = await stripe.subscriptionSchedules.update(schedule.id, {
        phases,
        metadata: {
          ...(schedule.metadata || {}),
          scheduled_downgrade: 'true',
          downgrade_date: contractEnd || '',
        },
      })

      return NextResponse.json({ status: 'scheduled', scheduleId: updatedSchedule.id, effectiveDate: contractEnd })
    }

    // No contract / contract ended: downgrade immediately with proration credit
    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newLowerPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    })

    return NextResponse.json({ status: 'immediate', subscriptionId: updated.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}



import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { PRICING_CONFIG } from '@/config/pricing';
import { PrismaClient } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Disable body parsing, we need the raw body for webhook signature verification
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Handle different event types
    console.log(`📨 Processing webhook event: ${event.type}`);
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
        
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    console.log(`✅ Successfully processed webhook event: ${event.type}`);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const purchaseType = session.metadata?.type;
  
  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  // Retrieve the checkout session with line items
  const checkoutSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items'],
  });

  try {
    if (purchaseType === 'subscription') {
      // Handle subscription signup
      const subscriptionId = checkoutSession.subscription as string;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      const price = subscription.items.data[0]?.price;
      const tier = determineTier(price?.id);
      
      // Determine credits based on tier
      let credits = 0;
      if (tier === 'individual') {
        credits = PRICING_CONFIG.individual.includedCredits;
      } else if (tier === 'pro') {
        credits = PRICING_CONFIG.pro.includedCredits;
      }
      
      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Update user subscription info
        await tx.user.update({
          where: { id: userId },
          data: {
            subscriptionTier: tier,
            subscriptionStatus: 'active',
            stripeSubscriptionId: subscriptionId,
          },
        });
        
        // Record credit transaction
        await tx.creditTransaction.create({
          data: {
            userId,
            credits: credits,
            type: 'purchase',
            description: `Subscription signup - ${tier}`,
            amount: price?.unit_amount ? price.unit_amount / 100 : 0,
            currency: 'USD',
            stripePaymentId: subscription.latest_invoice as string,
            stripeSubscriptionId: subscriptionId,
            planTier: tier,
            planPeriod: price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
            metadata: {
              stripePriceId: price?.id,
              subscriptionId: subscriptionId,
            },
          },
        });
      });
      
    } else if (purchaseType === 'try_once') {
      // Handle Try Once purchase
      const credits = PRICING_CONFIG.tryOnce.credits;
      const price = PRICING_CONFIG.tryOnce.price;
      
      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            subscriptionTier: 'try_once',
            subscriptionStatus: 'active',
          },
        });
        
        await tx.creditTransaction.create({
          data: {
            userId,
            credits: credits,
            type: 'purchase',
            description: 'Try Once purchase',
            amount: price,
            currency: 'USD',
            stripePaymentId: session.payment_intent as string,
            planTier: 'try_once',
            planPeriod: 'one_time',
            metadata: {
              stripeSessionId: session.id,
            },
          },
        });
      });
      
    } else if (purchaseType === 'top_up') {
      // Handle credit top-up
      const credits = parseInt(session.metadata?.credits || '0');
      const tier = session.metadata?.tier as 'individual' | 'pro' | undefined;
      
      let price = 0;
      if (tier === 'individual') {
        price = PRICING_CONFIG.individual.topUp.pricePerPackage;
      } else if (tier === 'pro') {
        price = PRICING_CONFIG.pro.topUp.pricePerPackage;
      }
      
      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        
        await tx.creditTransaction.create({
          data: {
            userId,
            credits: credits,
            type: 'purchase',
            description: `Credit top-up - ${credits} credits`,
            amount: price * Math.ceil(credits / (tier === 'individual' ? PRICING_CONFIG.individual.topUp.creditsPerPackage : PRICING_CONFIG.pro.topUp.creditsPerPackage)),
            currency: 'USD',
            stripePaymentId: session.payment_intent as string,
            planTier: tier,
            planPeriod: 'one_time',
            metadata: {
              stripeSessionId: session.id,
              topUpCredits: credits,
              tier: tier,
            },
          },
        });
      });
    }
  } catch (error) {
    console.error('Error processing checkout:', error);
    throw error;
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  try {
    console.log('🔄 Processing subscription update:', subscription.id);
    
    // Try to get userId from metadata first (for new subscriptions)
    let userId = subscription.metadata?.userId;
    
    if (!userId) {
      // For existing subscriptions (upgrades), find user by customer ID
      const customerId = typeof subscription.customer === 'string' 
        ? subscription.customer 
        : subscription.customer.id;
      
      console.log('🔍 Looking up user by customer ID:', customerId);
      
      const user = await prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
        select: { id: true }
      });
      
      if (!user) {
        console.error('❌ User not found for customer ID:', customerId);
        return;
      }
      
      userId = user.id;
      console.log('✅ Found user:', userId);
    }

    const price = subscription.items.data[0]?.price;
    const tier = determineTier(price?.id);
    
    console.log('📊 Subscription details:', {
      userId,
      tier,
      status: subscription.status,
      priceId: price?.id
    });
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: tier,
        subscriptionStatus: subscription.status === 'active' ? 'active' : 'cancelled',
        stripeSubscriptionId: subscription.id,
      },
    });
    
    console.log('✅ Subscription updated successfully');
  } catch (error) {
    console.error('❌ Error in handleSubscriptionUpdate:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  
  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: null,
      subscriptionStatus: 'cancelled',
      stripeSubscriptionId: null,
    },
  });
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Payment succeeded - additional logging or notification
  console.log('Payment succeeded:', paymentIntent.id);
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  // Payment failed - send notification or log error
  console.error('Payment failed:', paymentIntent.id, paymentIntent.last_payment_error);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle subscription renewals - allocate monthly credits
  const subscriptionId = (invoice as { subscription?: string }).subscription;
  
  if (subscriptionId) {
    
    // Get the subscription to find the user
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;
    
    // Find user by Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });
    
    if (!user) {
      console.error('User not found for customer ID:', customerId);
      return;
    }
    
    // Check if this is the first invoice (signup) or a renewal
    // For new subscriptions, the first invoice is created immediately after signup
    // We should only process renewals, not the initial payment
    const subscriptionCreatedAt = new Date(subscription.created * 1000);
    const invoiceCreatedAt = new Date(invoice.created * 1000);
    const timeDifference = invoiceCreatedAt.getTime() - subscriptionCreatedAt.getTime();
    
    // If the invoice was created within 5 minutes of the subscription, it's likely the initial payment
    // Skip processing to avoid double credits
    if (timeDifference < 5 * 60 * 1000) { // 5 minutes in milliseconds
      console.log('Skipping initial invoice payment - credits already allocated during signup');
      return;
    }
    
    // Determine tier from subscription
    const price = subscription.items.data[0]?.price;
    const tier = determineTier(price?.id);
    
    if (!tier) {
      console.error('Could not determine tier for subscription:', subscriptionId);
      return;
    }
    
    // Get credits for this tier
    let credits = 0;
    if (tier === 'individual') {
      credits = PRICING_CONFIG.individual.includedCredits;
    } else if (tier === 'pro') {
      credits = PRICING_CONFIG.pro.includedCredits;
    }
    
    // Add credits to user account
    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      
      // Record credit transaction for renewal credits
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          credits: credits,
          type: 'purchase',
          description: `Monthly credits - ${tier} subscription renewal`,
          amount: price?.unit_amount ? price.unit_amount / 100 : 0,
          currency: 'USD',
          stripePaymentId: invoice.id,
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId: subscriptionId,
          planTier: tier,
          planPeriod: price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
          metadata: {
            stripePriceId: price?.id,
            subscriptionId: subscriptionId,
            invoiceId: invoice.id,
            renewal: true,
          },
        },
      });
    });
  }
}

function determineTier(priceId: string | undefined): string | null {
  if (!priceId) return null;
  
  if (
    priceId === PRICING_CONFIG.individual.monthly.stripePriceId ||
    priceId === PRICING_CONFIG.individual.annual.stripePriceId
  ) {
    return 'individual';
  }
  
  if (
    priceId === PRICING_CONFIG.pro.monthly.stripePriceId ||
    priceId === PRICING_CONFIG.pro.annual.stripePriceId
  ) {
    return 'pro';
  }
  
  return null;
}

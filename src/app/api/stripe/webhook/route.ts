import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getRequestHeader } from '@/lib/server-headers';
import { Env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { PRICING_CONFIG } from '@/config/pricing';
import { PrismaClient } from '@prisma/client';
import { Logger } from '@/lib/logger';

const stripe = new Stripe(Env.string('STRIPE_SECRET_KEY', ''), {
  apiVersion: '2025-10-29.clover',
});

// Webhook secret: Not required if Stripe webhooks are handled externally
// Only needed if you want to test webhooks locally with Stripe CLI
// Webhook secret is required in production for security
// Can be omitted in development for local Stripe CLI testing
const webhookSecret = Env.string('STRIPE_WEBHOOK_SECRET', '').trim();
const isProduction = Env.string('NODE_ENV', 'development') === 'production';

// Disable body parsing, we need the raw body for webhook signature verification
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = await getRequestHeader('stripe-signature');

    // Verify webhook signature
    let event: Stripe.Event;
    
    // In production, webhook secret is required for security
    if (isProduction && !webhookSecret) {
      Logger.error('Webhook secret is required in production');
      return NextResponse.json(
        { error: 'Webhook secret configuration required' },
        { status: 500 }
      );
    }
    
    // Skip signature verification only in development when webhook secret is not set
    if (!webhookSecret) {
      Logger.warn('Webhook secret not configured, skipping signature verification');
      event = JSON.parse(body) as Stripe.Event;
    } else {
      // When webhook secret is configured, signature verification is required
      if (!signature) {
        return NextResponse.json(
          { error: 'Missing stripe-signature header' },
          { status: 400 }
        );
      }
      
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        Logger.error('Webhook signature verification failed', { error: err instanceof Error ? err.message : String(err) });
        return NextResponse.json(
          { error: 'Webhook signature verification failed' },
          { status: 400 }
        );
      }
    }

    // Handle different event types
    Logger.info(`Processing webhook event: ${event.type}`);
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
        
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      default:
        Logger.warn(`Unhandled event type: ${event.type}`);
    }
    
    Logger.info(`Successfully processed webhook event: ${event.type}`);

    return NextResponse.json({ received: true });
  } catch (error) {
    Logger.error('Webhook error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

function getInvoicePaymentIntentId(invoice: Stripe.Invoice): string {
  const pi = (invoice as unknown as { payment_intent?: string | { id?: string } | null }).payment_intent;
  if (typeof pi === 'string') return pi;
  if (pi && typeof pi === 'object' && 'id' in pi && typeof pi.id === 'string') return pi.id;
  return invoice.id;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  let userId = session.metadata?.userId as string | undefined;
  const purchaseType = session.metadata?.type;
  
  // In unauthenticated checkout flows, we won't have a userId.
  // Fallback: look up/create a user by email from the session and attach the Stripe customer ID.
  if (!userId) {
    const email = (session.customer_details?.email || session.customer_email || '').toLowerCase();
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (!email) {
      Logger.error('No userId and no email on checkout session; cannot attribute purchase', { sessionId: session.id });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      userId = existing.id;
      if (customerId && !existing.stripeCustomerId) {
        await prisma.user.update({ where: { id: existing.id }, data: { stripeCustomerId: customerId } });
      }
    } else {
      const created = await prisma.user.create({
        data: {
          email,
          // password will be set after OTP verification; leave null/empty if allowed by schema
          role: 'user',
          stripeCustomerId: customerId || null,
          subscriptionStatus: 'active',
        },
        select: { id: true }
      });
      userId = created.id;
    }
  }

  // Retrieve the checkout session with line items
  const checkoutSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items'],
  });

  try {
    if (purchaseType === 'plan') {
      // Handle one-time plan purchase
      const priceId = checkoutSession.line_items?.data[0]?.price?.id;
      const tier = determineTier(priceId);
      
      if (!tier) {
        Logger.error('Could not determine tier for plan purchase', { 
          priceId, 
          sessionId: session.id,
          lineItems: checkoutSession.line_items?.data 
        });
        throw new Error(`Unable to determine tier for price ID: ${priceId}`);
      }
      
      // Determine credits based on tier
      let credits = 0;
      if (tier === 'individual') {
        credits = PRICING_CONFIG.individual.credits;
      } else if (tier === 'proSmall') {
        credits = PRICING_CONFIG.proSmall.credits;
      } else if (tier === 'proLarge') {
        credits = PRICING_CONFIG.proLarge.credits;
      }
      
      if (credits === 0) {
        Logger.error('Credits are 0 for plan purchase', { tier, priceId, sessionId: session.id });
        throw new Error(`No credits configured for tier: ${tier}`);
      }
      
      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Update user plan info
        await tx.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'active',
            planTier: tier,
            planPeriod: tier, // Use tier as period for one-time purchases
          },
        });
        
        // For proSmall/proLarge tiers, get teamId from person
        const person = await tx.person.findUnique({ where: { userId: userId || '' } })
        const teamId = (tier === 'proSmall' || tier === 'proLarge') ? person?.teamId || null : null
        
        // Record credit transaction
        await tx.creditTransaction.create({
          data: {
            userId,
            teamId: teamId || undefined,
            credits: credits,
            type: 'purchase',
            description: `Plan purchase - ${tier}`,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            currency: 'USD',
            stripePaymentId: session.payment_intent as string,
            planTier: tier,
            planPeriod: tier,
            metadata: {
              stripePriceId: priceId,
              sessionId: session.id,
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
            subscriptionStatus: 'active',
            planTier: 'individual', // default; real tier remains guided by account mode elsewhere
            planPeriod: 'try_once',
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
            planTier: 'individual',
            planPeriod: 'try_once',
            metadata: {
              stripeSessionId: session.id,
            },
          },
        });
        type PrismaWithSubscriptionChange = typeof prisma & { subscriptionChange: { create: (args: unknown) => Promise<unknown> } }
        const txEx = tx as unknown as PrismaWithSubscriptionChange
        await txEx.subscriptionChange.create({
          data: {
            userId,
            planTier: 'individual',
            planPeriod: 'try_once',
            action: 'start',
            metadata: { checkoutSessionId: session.id },
          }
        })
      });
      
    } else if (purchaseType === 'top_up') {
      // Handle credit top-up
      const credits = parseInt(session.metadata?.credits || '0');
      const tier = session.metadata?.tier as 'individual' | 'proSmall' | 'proLarge' | undefined;
      
      let price = 0;
      if (tier === 'individual') {
        price = PRICING_CONFIG.individual.topUp.price;
      } else if (tier === 'proSmall') {
        price = PRICING_CONFIG.proSmall.topUp.price;
      } else if (tier === 'proLarge') {
        price = PRICING_CONFIG.proLarge.topUp.price;
      }
      
      // Allow repeat top-ups; do not block subsequent purchases

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const person = await tx.person.findUnique({ where: { userId: userId || '' } })
        const teamId = (tier === 'proSmall' || tier === 'proLarge') ? person?.teamId || null : null
        
        await tx.creditTransaction.create({
          data: {
            userId,
            teamId: teamId || undefined,
            credits: credits,
            type: 'purchase',
            description: `Credit top-up - ${credits} credits`,
            amount: price * Math.ceil(credits / (tier === 'individual' ? PRICING_CONFIG.individual.topUp.credits :
              tier === 'proSmall' ? PRICING_CONFIG.proSmall.topUp.credits :
              tier === 'proLarge' ? PRICING_CONFIG.proLarge.topUp.credits : 50)),
            currency: 'USD',
            stripePaymentId: session.payment_intent as string,
            planTier: tier,
            planPeriod: 'try_once',
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
    Logger.error('Error processing checkout', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}



async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Payment succeeded - additional logging or notification
  Logger.info('Payment succeeded', { paymentIntentId: paymentIntent.id });
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  // Payment failed - send notification or log error
  Logger.error('Payment failed', { paymentIntentId: paymentIntent.id, error: paymentIntent.last_payment_error });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle subscription renewals - allocate monthly credits
  const subscriptionId = (invoice as { subscription?: string }).subscription;
  
  // Check if this is a credit top-up first
  if (invoice.metadata?.credit_topup === 'true') {
    await handleCreditTopUp(invoice);
    return;
  }
  
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
      Logger.error('User not found for customer ID', { customerId });
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
      Logger.info('Skipping initial invoice payment - credits already allocated during signup');
      return;
    }
    
    // Determine tier from subscription
    const price = subscription.items.data[0]?.price;
    const tier = determineTier(price?.id);
    
    if (!tier) {
      Logger.error('Could not determine tier for subscription', { subscriptionId });
      return;
    }
    
    // Get credits for this tier
    let credits = 0;
    if (tier === 'individual') {
      credits = PRICING_CONFIG.individual.credits;
    } else if (tier === 'proSmall') {
      credits = PRICING_CONFIG.proSmall.credits;
    } else if (tier === 'proLarge') {
      credits = PRICING_CONFIG.proLarge.credits;
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

async function handleCreditTopUp(invoice: Stripe.Invoice) {
  try {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) {
      Logger.error('No customer ID found for credit top-up invoice', { invoiceId: invoice.id });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      Logger.error('User not found for credit top-up', { customerId, invoiceId: invoice.id });
      return;
    }

    const credits = parseInt(invoice.metadata?.credits || '0');
    const tier = invoice.metadata?.tier || 'try_once';

    if (credits <= 0) {
      Logger.error('Invalid credits amount for top-up', { credits, invoiceId: invoice.id });
      return;
    }

    // Check if we've already processed this invoice to avoid double-crediting
    const existingTransaction = await prisma.creditTransaction.findFirst({
      where: {
        stripeInvoiceId: invoice.id,
        type: 'purchase',
      },
    });

    if (existingTransaction) {
      Logger.info('Credit top-up already processed', { invoiceId: invoice.id, transactionId: existingTransaction.id });
      return;
    }

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const person = await tx.person.findUnique({ where: { userId: user.id } })

      // For pro tier, always allocate as team credits (even without a team)
      // This allows pro users to use team features and credits get migrated when they create a team
      const shouldBeTeamCredits = tier === 'pro'

      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          teamId: shouldBeTeamCredits ? (person?.teamId || null) : null, // null for pro = unmigrated team credits
          credits: credits,
          type: 'purchase',
          description: `Credit top-up - ${tier} (${credits} credits)`,
          amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
          currency: 'USD',
          stripePaymentId: getInvoicePaymentIntentId(invoice),
          stripeInvoiceId: invoice.id,
          planTier: tier,
          planPeriod: 'try_once',
          metadata: {
            stripeInvoiceId: invoice.id,
            topUpCredits: credits,
            tier: tier,
          },
        },
      });
    });

    Logger.info('Credit top-up processed successfully', { 
      userId: user.id, 
      credits, 
      tier, 
      invoiceId: invoice.id 
    });
  } catch (error) {
    Logger.error('Error processing credit top-up', { error: error instanceof Error ? error.message : String(error), invoiceId: invoice.id });
  }
}


function determineTier(priceId: string | undefined): string | null {
  if (!priceId) return null;
  
  if (priceId === PRICING_CONFIG.individual.stripePriceId) {
    return 'individual';
  }
  
  if (priceId === PRICING_CONFIG.proSmall.stripePriceId) {
    return 'proSmall';
  }

  if (priceId === PRICING_CONFIG.proLarge.stripePriceId) {
    return 'proLarge';
  }

  if (priceId === PRICING_CONFIG.tryOnce.stripePriceId) {
    return 'tryOnce';
  }
  
  return null;
}

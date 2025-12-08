import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getRequestHeader } from '@/lib/server-headers';
import { Env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { PRICING_CONFIG, getPricingConfigKey } from '@/config/pricing';
import { PrismaClient } from '@prisma/client';
import { Logger } from '@/lib/logger';
import type { PlanTier, PlanPeriod } from '@/domain/subscription/utils';
import { generatePasswordSetupToken } from '@/domain/auth/password-setup';
import { sendWelcomeAfterPurchaseEmail, sendOrderNotificationEmail } from '@/lib/email';
import { getBaseUrl } from '@/lib/url';
import { calculatePhotosFromCredits } from '@/domain/pricing/utils';

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
  let isNewGuestUser = false;
  let guestEmail = '';
  
  // In unauthenticated checkout flows, we won't have a userId.
  // Fallback: look up/create a user by email from the session and attach the Stripe customer ID.
  if (!userId) {
    const email = (session.customer_details?.email || session.customer_email || '').toLowerCase();
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (!email) {
      Logger.error('No userId and no email on checkout session; cannot attribute purchase', { sessionId: session.id });
      return;
    }
    guestEmail = email;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      userId = existing.id;
      if (customerId && !existing.stripeCustomerId) {
        await prisma.user.update({ where: { id: existing.id }, data: { stripeCustomerId: customerId } });
      }
      
      // Ensure Person record exists for existing user (in case they didn't complete signup)
      const existingPerson = await prisma.person.findUnique({ where: { userId: existing.id } });
      if (!existingPerson) {
        const customerName = session.customer_details?.name || '';
        const firstName = customerName.split(' ')[0] || 'User';
        const lastName = customerName.split(' ').slice(1).join(' ') || null;
        
        await prisma.person.create({
          data: {
            firstName,
            lastName,
            email,
            userId: existing.id,
            onboardingState: JSON.stringify({
              state: 'not_started',
              completedTours: [],
              pendingTours: [],
              lastUpdated: new Date().toISOString(),
            }),
          }
        });
        Logger.info('Person created for existing user without Person', { userId: existing.id, email });
      }
      
      // Existing user with no password set also needs password setup email
      if (!existing.password) {
        isNewGuestUser = true;
      }
    } else {
      // Create user and person record together for guest checkout
      const customerName = session.customer_details?.name || '';
      const firstName = customerName.split(' ')[0] || 'User';
      const lastName = customerName.split(' ').slice(1).join(' ') || null;
      
      // Determine role based on plan tier - pro plans get team_admin role
      const planTier = session.metadata?.planTier;
      const userRole = (planTier === 'pro') ? 'team_admin' : 'user';
      
      const created = await prisma.user.create({
        data: {
          email,
          // password will be set via email link; leave null for guest checkout
          role: userRole,
          stripeCustomerId: customerId || null,
          subscriptionStatus: 'active',
        },
        select: { id: true }
      });
      userId = created.id;
      
      // Create Person record so user can generate photos
      await prisma.person.create({
        data: {
          firstName,
          lastName,
          email,
          userId: created.id,
          onboardingState: JSON.stringify({
            state: 'not_started',
            completedTours: [],
            pendingTours: [],
            lastUpdated: new Date().toISOString(),
          }),
        }
      });
      
      isNewGuestUser = true;
      Logger.info('Guest user and person created', { userId: created.id, email, firstName, role: userRole });
    }
  }

  // Retrieve the checkout session with line items
  const checkoutSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items'],
  });

  try {
    if (purchaseType === 'plan') {
      // Handle one-time plan purchase
      // Extract tier and period from metadata (set in checkout route)
      const planTier = session.metadata?.planTier as PlanTier | undefined
      const planPeriod = session.metadata?.planPeriod as PlanPeriod | undefined
      const priceId = checkoutSession.line_items?.data[0]?.price?.id;
      
      // Fallback: determine tier+period from price ID if not in metadata
      let finalTier: PlanTier | null = planTier || null
      let finalPeriod: PlanPeriod | null = planPeriod || null
      
      if (!finalTier || !finalPeriod) {
        if (priceId === PRICING_CONFIG.individual.stripePriceId) {
          finalTier = 'individual'
          finalPeriod = 'small'
        } else if (priceId === PRICING_CONFIG.proSmall.stripePriceId) {
          finalTier = 'pro'
          finalPeriod = 'small'
        } else if (priceId === PRICING_CONFIG.proLarge.stripePriceId) {
          finalTier = 'pro'
          finalPeriod = 'large'
        } else if (priceId === PRICING_CONFIG.enterprise.stripePriceId) {
          finalTier = 'pro'
          finalPeriod = 'large'
        }
      }
      
      if (!finalTier || !finalPeriod) {
        Logger.error('Could not determine tier/period for plan purchase', { 
          planTier,
          planPeriod,
          priceId, 
          sessionId: session.id,
          lineItems: checkoutSession.line_items?.data 
        });
        throw new Error(`Unable to determine tier/period for price ID: ${priceId}`);
      }
      
      // Get pricing config key to determine credits
      // Enterprise uses pro/large tier/period but enterprise credits
      const isEnterprise = priceId === PRICING_CONFIG.enterprise.stripePriceId
      const configKey = isEnterprise ? 'enterprise' as const : getPricingConfigKey(finalTier, finalPeriod)
      if (!configKey) {
        Logger.error('Invalid tier/period combination', { tier: finalTier, period: finalPeriod });
        throw new Error(`Invalid tier/period combination: ${finalTier}/${finalPeriod}`);
      }
      
      // Type-safe access to pricing tiers (not other config keys)
      type PricingTierKey = 'individual' | 'proSmall' | 'proLarge' | 'vip' | 'enterprise'
      const credits = PRICING_CONFIG[configKey as PricingTierKey].credits
      
      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Update user plan info
        await tx.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'active',
            planTier: finalTier,
            planPeriod: finalPeriod,
          },
        });
        
        // For pro tiers, get teamId from person
        const person = await tx.person.findUnique({ where: { userId: userId || '' } })
        const teamId = (finalTier === 'pro') ? person?.teamId || null : null
        
        // Record credit transaction
        await tx.creditTransaction.create({
          data: {
            userId,
            teamId: teamId || undefined,
            credits: credits,
            type: 'purchase',
            description: `Plan purchase - ${finalTier} ${finalPeriod}`,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            currency: 'USD',
            stripePaymentId: session.payment_intent as string,
            planTier: finalTier,
            planPeriod: finalPeriod,
            metadata: {
              stripePriceId: priceId,
              sessionId: session.id,
            },
          },
        });
        
        // Record subscription change
        type PrismaWithSubscriptionChange = typeof prisma & { subscriptionChange: { create: (args: unknown) => Promise<unknown> } }
        const txEx = tx as unknown as PrismaWithSubscriptionChange
        await txEx.subscriptionChange.create({
          data: {
            userId,
            planTier: finalTier,
            planPeriod: finalPeriod,
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
        
        // Get user's current planPeriod for top-up transaction
        const user = await tx.user.findUnique({ where: { id: userId || '' }, select: { planPeriod: true } })
        const planPeriod = (user?.planPeriod && user.planPeriod !== 'free' && user.planPeriod !== 'tryOnce' && user.planPeriod !== 'try_once') 
          ? user.planPeriod 
          : (tier === 'proLarge' ? 'large' : 'small')
        
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
            planPeriod: planPeriod,
            metadata: {
              stripeSessionId: session.id,
              topUpCredits: credits,
              tier: tier,
            },
          },
        });
      });
    }
    
    // Send order notification to support
    try {
      const customerName = session.customer_details?.name || '';
      const customerEmail = guestEmail || session.customer_details?.email || session.customer_email || '';
      
      let orderCredits = 0;
      let orderTier: string | null = null;
      let orderPeriod: string | null = null;
      
      if (purchaseType === 'plan') {
        orderTier = session.metadata?.planTier || null;
        orderPeriod = session.metadata?.planPeriod || null;
        const configKey = getPricingConfigKey(
          (orderTier as PlanTier) || 'individual', 
          (orderPeriod as PlanPeriod) || 'small'
        );
        if (configKey) {
          orderCredits = PRICING_CONFIG[configKey].credits;
        }
      } else if (purchaseType === 'top_up') {
        orderCredits = parseInt(session.metadata?.credits || '0');
        orderTier = session.metadata?.tier || null;
      }
      
      await sendOrderNotificationEmail({
        customerEmail,
        customerName,
        orderType: purchaseType as 'plan' | 'top_up',
        planTier: orderTier,
        planPeriod: orderPeriod,
        credits: orderCredits,
        amountPaid: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency || 'USD',
        stripeSessionId: session.id,
        isNewUser: isNewGuestUser,
      });
      
      Logger.info('Order notification sent to support', { 
        customerEmail, 
        orderType: purchaseType, 
        amount: session.amount_total ? session.amount_total / 100 : 0 
      });
    } catch (notifyError) {
      // Don't fail the webhook if notification fails
      Logger.error('Failed to send order notification', {
        error: notifyError instanceof Error ? notifyError.message : String(notifyError),
      });
    }
    
    // Send welcome email with password setup link for new guest users
    if (isNewGuestUser && guestEmail) {
      try {
        // Determine photos from purchase for the email (convert credits to photos)
        let purchasedCredits = 0;
        if (purchaseType === 'plan') {
          const priceId = checkoutSession.line_items?.data[0]?.price?.id;
          const isEnterprise = priceId === PRICING_CONFIG.enterprise.stripePriceId;
          if (isEnterprise) {
            purchasedCredits = PRICING_CONFIG.enterprise.credits;
          } else {
            const planTier = session.metadata?.planTier as PlanTier | undefined;
            const planPeriod = session.metadata?.planPeriod as PlanPeriod | undefined;
            const configKey = getPricingConfigKey(planTier || 'individual', planPeriod || 'small');
            if (configKey) {
              purchasedCredits = PRICING_CONFIG[configKey].credits;
            }
          }
        } else if (purchaseType === 'top_up') {
          purchasedCredits = parseInt(session.metadata?.credits || '0');
        }
        
        // Convert credits to photos for display
        const purchasedPhotos = calculatePhotosFromCredits(purchasedCredits);
        
        const token = await generatePasswordSetupToken(guestEmail);
        const baseUrl = await getBaseUrl();
        const setupLink = `${baseUrl}/auth/set-password?token=${token}`;
        
        await sendWelcomeAfterPurchaseEmail({
          email: guestEmail,
          setupLink,
          photos: purchasedPhotos,
          locale: 'en', // Default to English, could be stored in session metadata
        });
        
        Logger.info('Welcome email sent to guest user', { email: guestEmail, photos: purchasedPhotos });
      } catch (emailError) {
        // Don't fail the webhook if email fails - user can still request a new link
        Logger.error('Failed to send welcome email', { 
          error: emailError instanceof Error ? emailError.message : String(emailError),
          email: guestEmail 
        });
      }
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
    const tierStr = determineTier(price?.id);
    
    if (!tierStr) {
      Logger.error('Could not determine tier for subscription', { subscriptionId });
      return;
    }

    // Map to strict PlanTier/PlanPeriod
    let finalTier: PlanTier = 'individual';
    let finalPeriod: PlanPeriod = 'small';
    
    if (tierStr === 'proSmall') {
        finalTier = 'pro';
        finalPeriod = 'small';
    } else if (tierStr === 'proLarge') {
        finalTier = 'pro';
        finalPeriod = 'large';
    } else {
        finalTier = 'individual';
        finalPeriod = 'small';
    }
    
    // Get credits for this tier
    let credits = 0;
    if (tierStr === 'individual') {
      credits = PRICING_CONFIG.individual.credits;
    } else if (tierStr === 'proSmall') {
      credits = PRICING_CONFIG.proSmall.credits;
    } else if (tierStr === 'proLarge') {
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
          description: `Monthly credits - ${tierStr} subscription renewal`,
          amount: price?.unit_amount ? price.unit_amount / 100 : 0,
          currency: 'USD',
          stripePaymentId: invoice.id,
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId: subscriptionId,
          planTier: finalTier,
          planPeriod: finalPeriod,
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
    const tierStr = invoice.metadata?.tier || 'individual';
    
    // Map legacy/metadata tier strings to strict PlanTier
    let finalTier: PlanTier = 'individual';
    if (tierStr === 'proSmall' || tierStr === 'proLarge') {
      finalTier = 'pro';
    }

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
      const shouldBeTeamCredits = finalTier === 'pro'

      // Get user's current planPeriod for top-up transaction
      const userWithPeriod = await tx.user.findUnique({ where: { id: user.id }, select: { planPeriod: true } })
      const planPeriod = (userWithPeriod?.planPeriod && userWithPeriod.planPeriod !== 'free' && userWithPeriod.planPeriod !== 'tryOnce' && userWithPeriod.planPeriod !== 'try_once') 
        ? userWithPeriod.planPeriod as PlanPeriod
        : (tierStr === 'proLarge' ? 'large' : 'small')

      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          teamId: shouldBeTeamCredits ? (person?.teamId || null) : null, // null for pro = unmigrated team credits
          credits: credits,
          type: 'purchase',
          description: `Credit top-up - ${tierStr} (${credits} credits)`,
          amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
          currency: 'USD',
          stripePaymentId: getInvoicePaymentIntentId(invoice),
          stripeInvoiceId: invoice.id,
          planTier: finalTier,
          planPeriod: planPeriod as PlanPeriod,
          metadata: {
            stripeInvoiceId: invoice.id,
            topUpCredits: credits,
            tier: tierStr,
          },
        },
      });
    });

    Logger.info('Credit top-up processed successfully', { 
      userId: user.id, 
      credits, 
      tier: tierStr, 
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

  // tryOnce was replaced with tryItForFree (free tier, no stripePriceId)
  // Legacy tryOnce priceIds will return null
  
  return null;
}

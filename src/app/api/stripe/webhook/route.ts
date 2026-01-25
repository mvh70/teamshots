import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getRequestHeader } from '@/lib/server-headers';
import { Env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { PRICING_CONFIG, getPricingConfigKey } from '@/config/pricing';
import { Logger } from '@/lib/logger';
import type { PlanTier, PlanPeriod } from '@/domain/subscription/utils';
import { generatePasswordSetupToken } from '@/domain/auth/password-setup';
import { sendWelcomeAfterPurchaseEmail, sendOrderNotificationEmail } from '@/lib/email';
import { getBaseUrlForUser } from '@/lib/url';
import { calculatePhotosFromCredits } from '@/domain/pricing/utils';
import { recordPromoCodeUsage } from '@/domain/pricing/promo-codes';

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

// Type for Prisma transaction client - inferred from prisma instance
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

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
    // SECURITY NOTE: This is acceptable for development with Stripe CLI, but webhook
    // secret should always be configured in staging/production environments
    if (!webhookSecret) {
      Logger.warn('SECURITY: Webhook secret not configured, skipping signature verification. Use Stripe CLI for local testing.');
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

      // Get signup domain from checkout metadata (set by checkout route)
      const signupDomain = session.metadata?.checkoutDomain || null;

      const created = await prisma.user.create({
        data: {
          email,
          // password will be set via email link; leave null for guest checkout
          role: userRole,
          stripeCustomerId: customerId || null,
          subscriptionStatus: 'active',
          signupDomain,
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
        } else if (priceId === PRICING_CONFIG.vip.stripePriceId) {
          finalTier = 'individual'
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
      const configKey = getPricingConfigKey(finalTier, finalPeriod)
      if (!configKey) {
        Logger.error('Invalid tier/period combination', { tier: finalTier, period: finalPeriod });
        throw new Error(`Invalid tier/period combination: ${finalTier}/${finalPeriod}`);
      }

      // Type-safe access to pricing tiers
      type PricingTierKey = 'individual' | 'vip'
      const credits = PRICING_CONFIG[configKey as PricingTierKey].credits

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Get person record - Person is the business entity that owns credits
        const person = await tx.person.findUnique({ where: { userId: userId || '' } })
        if (!person) {
          Logger.error('Person not found for plan purchase', { userId, sessionId: session.id })
          throw new Error(`Person not found for userId: ${userId}`)
        }

        // Check if user already has an active paid plan
        const existingUser = await tx.user.findUnique({
          where: { id: userId },
          select: { planTier: true, planPeriod: true, subscriptionStatus: true }
        })

        // Determine if user has an existing paid subscription (not free/tryOnce)
        const existingPeriod = existingUser?.planPeriod
        const hasExistingPaidPlan = existingPeriod &&
          existingPeriod !== 'free' &&
          existingPeriod !== 'tryOnce' &&
          existingPeriod !== 'try_once'

        // Only update plan info if user doesn't have an existing paid plan
        // This prevents overwriting a team admin's pro plan when they purchase individual credits
        if (!hasExistingPaidPlan) {
          await tx.user.update({
            where: { id: userId },
            data: {
              subscriptionStatus: 'active',
              planTier: finalTier,
              planPeriod: finalPeriod,
            },
          });

          // Record subscription change only for new subscriptions
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
        } else {
          Logger.info('User already has paid plan, adding credits without changing plan', {
            userId,
            existingTier: existingUser?.planTier,
            existingPeriod: existingPeriod,
            purchasedTier: finalTier,
            purchasedPeriod: finalPeriod,
          })
        }

        // For credit allocation: use the PURCHASED tier, not the existing tier
        // This ensures team admins who buy individual credits get individual credits (not team credits)
        const teamId = (finalTier === 'pro') ? person.teamId || null : null

        // Record credit transaction - credits belong to Person (business entity), not User (auth)
        await tx.creditTransaction.create({
          data: {
            personId: person.id,
            teamId: teamId || undefined,
            credits: credits,
            type: 'purchase',
            description: hasExistingPaidPlan
              ? `Credit purchase - ${credits} credits (from ${finalTier} ${finalPeriod} checkout)`
              : `Plan purchase - ${finalTier} ${finalPeriod}`,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            currency: 'USD',
            stripePaymentId: session.payment_intent as string,
            planTier: finalTier,
            planPeriod: finalPeriod,
            metadata: {
              stripePriceId: priceId,
              sessionId: session.id,
              existingPlanPreserved: hasExistingPaidPlan,
            },
          },
        });
      });
      
    } else if (purchaseType === 'top_up') {
      // Handle credit top-up
      const credits = parseInt(session.metadata?.credits || '0');
      const tier = session.metadata?.tier as 'individual' | 'vip' | undefined;

      let price = 0;
      if (tier === 'vip') {
        price = PRICING_CONFIG.vip.topUp.price;
      } else {
        // Default to individual (covers individual tier and legacy tiers)
        price = PRICING_CONFIG.individual.topUp.price;
      }

      // Allow repeat top-ups; do not block subsequent purchases

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const person = await tx.person.findUnique({ where: { userId: userId || '' } })
        if (!person) {
          Logger.error('Person not found for top-up', { userId, sessionId: session.id })
          throw new Error(`Person not found for userId: ${userId}`)
        }
        const teamId = person.teamId || null

        // Get user's current planPeriod for top-up transaction
        const user = await tx.user.findUnique({ where: { id: userId || '' }, select: { planPeriod: true } })
        const planPeriod = (user?.planPeriod && user.planPeriod !== 'free' && user.planPeriod !== 'tryOnce' && user.planPeriod !== 'try_once')
          ? user.planPeriod
          : (tier === 'vip' ? 'large' : 'small')

        // Credits belong to Person (business entity), not User (auth)
        await tx.creditTransaction.create({
          data: {
            personId: person.id,
            teamId: teamId || undefined,
            credits: credits,
            type: 'purchase',
            description: `Credit top-up - ${credits} credits`,
            amount: price * Math.ceil(credits / (tier === 'vip' ? PRICING_CONFIG.vip.topUp.credits : PRICING_CONFIG.individual.topUp.credits)),
            currency: 'USD',
            stripePaymentId: session.payment_intent as string,
            planTier: tier || 'individual',
            planPeriod: planPeriod,
            metadata: {
              stripeSessionId: session.id,
              topUpCredits: credits,
              tier: tier || 'individual',
            },
          },
        });
      });
    } else if (purchaseType === 'seats') {
      // Handle seats purchase
      const seats = parseInt(session.metadata?.seats || '0');
      const priceId = checkoutSession.line_items?.data[0]?.price?.id;

      if (!seats || seats < 1) {
        Logger.error('Invalid seats count in metadata', { sessionId: session.id, seats });
        throw new Error('Invalid seats count');
      }

      // Note: We use dynamic pricing (price_data) for seats with graduated pricing,
      // so priceId will be dynamically generated by Stripe and won't match a fixed value

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Get or create team for the user
        let person = await tx.person.findUnique({
          where: { userId: userId || '' },
          include: { team: true }
        });

        let teamId: string;

        if (!person?.teamId) {
          // Create team if user doesn't have one yet
          const user = await tx.user.findUnique({ where: { id: userId || '' } });
          const team = await tx.team.create({
            data: {
              name: `${user?.email}'s Team`,
              adminId: userId || '',
              creditsPerSeat: PRICING_CONFIG.seats.creditsPerSeat,
              totalSeats: seats,
              activeSeats: 0, // Admin must self-assign a seat via the team dashboard
              isLegacyCredits: false,
            }
          });

          // Link person to team
          await tx.person.update({
            where: { userId: userId || '' },
            data: { teamId: team.id }
          });

          teamId = team.id;
          Logger.info('Created team for seats purchase', { userId, teamId: team.id, seats });
          // Note: Admin must explicitly self-assign a seat via /api/team/admin/assign-seat
        } else {
          // Add seats to existing team
          teamId = person.teamId;

          await tx.team.update({
            where: { id: teamId },
            data: {
              totalSeats: { increment: seats },
              creditsPerSeat: PRICING_CONFIG.seats.creditsPerSeat,
              isLegacyCredits: false,
            }
          });
          Logger.info('Added seats to existing team', { userId, teamId, seats });
          // Note: Admin must explicitly self-assign a seat via /api/team/admin/assign-seat
        }

        // Update user to pro tier
        await tx.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'active',
            planTier: 'pro',
            planPeriod: 'seats',
            role: 'team_admin',
          },
        });

        // Record seat purchase as a credit transaction
        // Credits belong to team (teamId), with personId for audit trail
        const totalCredits = seats * PRICING_CONFIG.seats.creditsPerSeat;
        const adminPerson = await tx.person.findUnique({ where: { userId: userId || '' } })
        await tx.creditTransaction.create({
          data: {
            teamId,
            personId: adminPerson?.id, // Track which person (admin) made the purchase
            type: 'seat_purchase',
            credits: totalCredits,
            amount: (session.amount_total || 0) / 100,
            currency: session.currency?.toUpperCase() || 'USD',
            stripePaymentId: (session.payment_intent as string) || session.id,
            description: `Purchased ${seats} seat${seats > 1 ? 's' : ''} (${totalCredits} credits)`,
            // Seats-specific fields
            seats,
            pricePerSeat: (session.amount_total || 0) / 100 / seats,
            stripePriceId: priceId || '',
            metadata: {
              checkoutSessionId: session.id,
              creditsPerSeat: PRICING_CONFIG.seats.creditsPerSeat,
              photosPerSeat: PRICING_CONFIG.seats.creditsPerSeat / PRICING_CONFIG.credits.perGeneration,
            }
          }
        });

        // Record subscription change
        type PrismaWithSubscriptionChange = typeof prisma & { subscriptionChange: { create: (args: unknown) => Promise<unknown> } }
        const txEx = tx as unknown as PrismaWithSubscriptionChange;
        await txEx.subscriptionChange.create({
          data: {
            userId,
            teamId,
            planTier: 'pro',
            planPeriod: 'seats',
            action: 'start',
            metadata: {
              checkoutSessionId: session.id,
              seats,
            },
          }
        });
      });
    }

    // Track promo code usage if a promo code was used
    const promoCodeId = session.metadata?.promoCodeId
    const promoCodeUsed = session.metadata?.promoCode
    if (promoCodeId && promoCodeUsed) {
      try {
        // Get discount amount from Stripe session
        const discountAmount = session.total_details?.amount_discount
          ? session.total_details.amount_discount / 100
          : 0
        const originalAmount = session.amount_total
          ? (session.amount_total + (session.total_details?.amount_discount || 0)) / 100
          : 0

        await recordPromoCodeUsage({
          promoCodeId,
          userId: userId || undefined,
          email: guestEmail || session.customer_details?.email || session.customer_email || undefined,
          discountAmount,
          originalAmount,
          stripeSessionId: session.id,
        })

        Logger.info('Recorded promo code usage', {
          promoCodeId,
          promoCode: promoCodeUsed,
          userId,
          discountAmount,
          sessionId: session.id,
        })
      } catch (promoError) {
        // Don't fail the webhook if promo tracking fails
        Logger.error('Failed to record promo code usage', {
          error: promoError instanceof Error ? promoError.message : String(promoError),
          promoCodeId,
          sessionId: session.id,
        })
      }
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
      } else if (purchaseType === 'seats') {
        const seats = parseInt(session.metadata?.seats || '0');
        orderCredits = seats * PRICING_CONFIG.seats.creditsPerSeat;
        orderTier = 'seats';
        orderPeriod = 'seats';
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
          const planTier = session.metadata?.planTier as PlanTier | undefined;
          const planPeriod = session.metadata?.planPeriod as PlanPeriod | undefined;
          const configKey = getPricingConfigKey(planTier || 'individual', planPeriod || 'small');
          if (configKey) {
            purchasedCredits = PRICING_CONFIG[configKey].credits;
          }
        } else if (purchaseType === 'top_up') {
          purchasedCredits = parseInt(session.metadata?.credits || '0');
        } else if (purchaseType === 'seats') {
          const seats = parseInt(session.metadata?.seats || '0');
          purchasedCredits = seats * PRICING_CONFIG.seats.creditsPerSeat;
        }
        
        // Convert credits to photos for display
        const purchasedPhotos = calculatePhotosFromCredits(purchasedCredits);

        const token = await generatePasswordSetupToken(guestEmail);
        // Use the domain from checkout session metadata for correct email URLs
        const checkoutDomain = session.metadata?.checkoutDomain;
        const baseUrl = getBaseUrlForUser(checkoutDomain);
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

    if (tierStr === 'vip') {
        finalTier = 'individual';
        finalPeriod = 'large';
    } else {
        finalTier = 'individual';
        finalPeriod = 'small';
    }

    // Get credits for this tier
    let credits = 0;
    if (tierStr === 'vip') {
      credits = PRICING_CONFIG.vip.credits;
    } else {
      // Default to individual (covers individual tier and legacy tiers)
      credits = PRICING_CONFIG.individual.credits;
    }
    
    // Add credits to user account - credits belong to Person (business entity)
    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const person = await tx.person.findUnique({ where: { userId: user.id } })
      if (!person) {
        Logger.error('Person not found for subscription renewal', { userId: user.id, invoiceId: invoice.id })
        throw new Error(`Person not found for userId: ${user.id}`)
      }

      // Record credit transaction for renewal credits
      await tx.creditTransaction.create({
        data: {
          personId: person.id,
          teamId: person.teamId || undefined,
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

    // Map metadata tier strings to strict PlanTier
    let finalTier: PlanTier = 'individual';
    if (tierStr === 'pro') {
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
      if (!person) {
        Logger.error('Person not found for credit top-up invoice', { userId: user.id, invoiceId: invoice.id })
        throw new Error(`Person not found for userId: ${user.id}`)
      }

      // For pro tier, always allocate as team credits (even without a team)
      const shouldBeTeamCredits = finalTier === 'pro'

      // Get user's current planPeriod for top-up transaction
      const userWithPeriod = await tx.user.findUnique({ where: { id: user.id }, select: { planPeriod: true } })
      const planPeriod = (userWithPeriod?.planPeriod && userWithPeriod.planPeriod !== 'free' && userWithPeriod.planPeriod !== 'tryOnce' && userWithPeriod.planPeriod !== 'try_once')
        ? userWithPeriod.planPeriod as PlanPeriod
        : (tierStr === 'vip' ? 'large' : 'small')

      // Credits belong to Person (business entity), not User (auth)
      await tx.creditTransaction.create({
        data: {
          personId: person.id,
          teamId: shouldBeTeamCredits ? (person.teamId || null) : null,
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
  
  if (priceId === PRICING_CONFIG.vip.stripePriceId) {
    return 'vip';
  }

  // Legacy pro tiers and tryOnce no longer supported
  return null;
}

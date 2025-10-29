import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PRICING_CONFIG } from '@/config/pricing';
import { Logger } from '@/lib/logger';
import { Env } from '@/lib/env';

const stripe = new Stripe(Env.string('STRIPE_SECRET_KEY', ''), {
  apiVersion: '2025-09-30.clover',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, priceId, quantity = 1, metadata = {}, unauth = false, email } = body as { type: string; priceId?: string; quantity?: number; metadata?: Record<string, string>; unauth?: boolean; email?: string };

    const session = unauth ? null : await auth();
    if (!session?.user?.id && !unauth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database to check for existing Stripe customer
    const user = session?.user?.id
      ? await prisma.user.findUnique({ where: { id: session.user.id } })
      : null;

    // Create or retrieve Stripe customer
    let stripeCustomerId = user?.stripeCustomerId || undefined;
    if (!unauth && user && !stripeCustomerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
      stripeCustomerId = customer.id;
    }

    // Determine the base URL with fallback - force HTTP for local development
    // Note: Stripe webhooks must point to HTTPS (https://app.teamshots.vip/api/stripe/webhook)
    // but local redirects should use HTTP (https://localhost:3000)
    const baseUrl = Env.string('NEXT_PUBLIC_BASE_URL')
    
    // Create specific success messages based on purchase type
    let successMessage = ''
    if (type === 'try_once') {
      successMessage = 'try_once_success'
    } else if (type === 'subscription') {
      const isIndividual = (
        priceId === PRICING_CONFIG.individual.monthly.stripePriceId ||
        priceId === PRICING_CONFIG.individual.annual.stripePriceId
      );
      const tier = isIndividual ? 'individual' : 'pro'
      successMessage = tier === 'individual' ? 'individual_success' : 'pro_success'
    } else if (type === 'top_up') {
      successMessage = 'top_up_success'
    }
    
    const tierMeta = (metadata as Record<string, string>)?.tier || ''
    const periodMeta = (metadata as Record<string, string>)?.period || ''
    const successUrl = unauth
      ? `${baseUrl}/auth/verify?success=true&type=${successMessage}&tier=${encodeURIComponent(tierMeta)}&period=${encodeURIComponent(periodMeta)}&email=${encodeURIComponent(email || '')}`
      : `${baseUrl}/en/app/dashboard?success=true&type=${successMessage}`
    const cancelUrl = unauth
      ? `${baseUrl}/auth/signup?canceled=true`
      : `${baseUrl}/en/app/settings?canceled=true`

    // Build checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      customer_email: unauth ? (email as string | undefined) : undefined,
      payment_method_types: ['card'],
      mode: type === 'try_once' || type === 'top_up' ? 'payment' : 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ...(user?.id ? { userId: user.id } : {}),
        type,
        ...metadata,
      },
    };

    // Add line items based on type
    if (type === 'try_once' || type === 'subscription') {
      // Use provided price ID for subscriptions and try once
      if (priceId) {
        sessionParams.line_items = [
          {
            price: priceId,
            quantity,
          },
        ];
      } else if (type === 'try_once') {
        // Fallback for Try Once if price ID is not configured
        sessionParams.line_items = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Try Once',
                description: `${PRICING_CONFIG.tryOnce.credits} credits for one generation`,
              },
              unit_amount: Math.round(PRICING_CONFIG.tryOnce.price * 100),
            },
            quantity,
          },
        ];
      }
    } else if (type === 'top_up') {
      // For top-ups, create a one-time payment. Support tiers: 'individual' | 'pro' | 'try_once'
      const { tier, credits } = metadata as { tier?: string; credits?: number };
      let pricePerPackage = 0;
      let creditsPerPackage = 0;
      if (tier === 'individual') {
        pricePerPackage = PRICING_CONFIG.individual.topUp.price;
        creditsPerPackage = PRICING_CONFIG.individual.topUp.credits;
      } else if (tier === 'pro') {
        pricePerPackage = PRICING_CONFIG.pro.topUp.price;
        creditsPerPackage = PRICING_CONFIG.pro.topUp.credits;
      } else {
        pricePerPackage = PRICING_CONFIG.tryOnce.topUp.price;
        creditsPerPackage = PRICING_CONFIG.tryOnce.topUp.credits;
      }

      const requestedCredits = typeof credits === 'number' ? credits : creditsPerPackage;
      const numPackages = Math.max(1, Math.ceil(requestedCredits / creditsPerPackage));
      const totalCredits = numPackages * creditsPerPackage;

      sessionParams.line_items = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Credit Top-Up (${totalCredits} credits)`,
              description: `Add ${totalCredits} credits to your account`,
            },
            unit_amount: Math.round(pricePerPackage * 100),
          },
          quantity: numPackages,
        },
      ];
      sessionParams.metadata = {
        ...sessionParams.metadata,
        credit_topup: 'true',
        tier: tier || 'try_once',
        credits: String(totalCredits),
      };
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    Logger.error('Stripe checkout error', { error: error instanceof Error ? error.message : String(error) });
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

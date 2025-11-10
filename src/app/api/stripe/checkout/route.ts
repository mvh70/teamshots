import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PRICING_CONFIG } from '@/config/pricing';
import { Logger } from '@/lib/logger';
import { Env } from '@/lib/env';


export const runtime = 'nodejs'
const stripe = new Stripe(Env.string('STRIPE_SECRET_KEY', ''), {
  apiVersion: '2025-10-29.clover',
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

    // Enforce business rules before creating session
    if (!unauth && user) {
      if (type === 'try_once') {
        const priorTryOnce = await prisma.creditTransaction.findFirst({
          where: { userId: user.id, planPeriod: 'try_once' }
        })
        if (priorTryOnce) {
          return NextResponse.json({ error: 'TRY_ONCE_ALREADY_USED' }, { status: 400 })
        }
      }
      if (type === 'top_up') {
        if ((user.planPeriod || '') === 'free') {
          return NextResponse.json({ error: 'TOP_UP_NOT_ALLOWED_ON_FREE' }, { status: 400 })
        }
      }
    }

    // Determine the base URL with fallback - force HTTP for local development
    // Note: Stripe webhooks must point to HTTPS (https://app.teamshots.vip/api/stripe/webhook)
    // but local redirects should use HTTP (https://localhost:3000)
    const baseUrl = Env.string('NEXT_PUBLIC_BASE_URL')
    
    // Prefer returning to the page that initiated checkout. Accept explicit body.returnUrl or Referer header.
    // Validate to prevent open redirects: must start with our baseUrl; otherwise, fall back to dashboard.
    const requestedReturnUrl = (body as Record<string, unknown>)?.returnUrl as string | undefined;
    const referer = request.headers.get('referer') || undefined;
    const preferredReturnUrl = requestedReturnUrl || referer || '';
    let safeReturnUrl = `${baseUrl}/en/app/dashboard`;
    try {
      if (preferredReturnUrl && preferredReturnUrl.startsWith(baseUrl)) {
        // Strip hash to avoid losing search params when we add ours
        safeReturnUrl = preferredReturnUrl.split('#')[0];
      }
    } catch {}

    // Helper to append query parameters
    const withParams = (url: string, params: Record<string, string>) => {
      const u = new URL(url);
      // Strip existing query params to avoid stale flags (e.g., canceled=true)
      u.search = ''
      Object.entries(params).forEach(([k, v]) => {
        if (typeof v === 'string' && v.length) {
          u.searchParams.set(k, v);
        }
      });
      return u.toString();
    };

    // Create specific success messages based on purchase type
    let successMessage = ''
    let successTier = ''
    let successPeriod = ''
    if (type === 'try_once') {
      successMessage = 'try_once_success'
    } else if (type === 'subscription') {
      const isIndividual = (
        priceId === PRICING_CONFIG.individual.monthly.stripePriceId ||
        priceId === PRICING_CONFIG.individual.annual.stripePriceId
      );
      const isAnnual = (
        priceId === PRICING_CONFIG.individual.annual.stripePriceId ||
        priceId === PRICING_CONFIG.pro.annual.stripePriceId
      );
      const tier = isIndividual ? 'individual' : 'pro'
      successMessage = tier === 'individual' ? 'individual_success' : 'pro_success'
      successTier = tier
      successPeriod = isAnnual ? 'annual' : 'monthly'
    } else if (type === 'top_up') {
      successMessage = 'top_up_success'
    }
    
    const tierMeta = (metadata as Record<string, string>)?.tier || successTier
    const periodMeta = (metadata as Record<string, string>)?.period || successPeriod
    const queryExtras = type === 'subscription'
      ? { tier: encodeURIComponent(tierMeta), period: encodeURIComponent(periodMeta) }
      : {}

    const successUrl = unauth
      ? `${baseUrl}/auth/verify?success=true&type=${successMessage}${type === 'subscription' ? `&tier=${encodeURIComponent(tierMeta)}&period=${encodeURIComponent(periodMeta)}` : ''}&email=${encodeURIComponent(email || '')}`
      : withParams(safeReturnUrl, { success: 'true', type: successMessage, ...(queryExtras as Record<string, string>) })

    const cancelUrl = unauth
      ? `${baseUrl}/auth/signup?canceled=true`
      : withParams(safeReturnUrl, { canceled: 'true' })

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
      // Allow repeat purchases of top-ups; no one-per-tier restriction
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    Logger.error('Failed to create checkout session', { error: message });
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}

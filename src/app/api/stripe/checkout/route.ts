import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PRICING_CONFIG } from '@/config/pricing';
import { Logger } from '@/lib/logger';
import { Env } from '@/lib/env';
import { getBaseUrl } from '@/lib/url';
import type { PlanTier, PlanPeriod } from '@/domain/subscription/utils';
import { validatePromoCode, type PurchaseType } from '@/domain/pricing/promo-codes';
import { getBrand } from '@/config/brand';


export const runtime = 'nodejs'
const stripe = new Stripe(Env.string('STRIPE_SECRET_KEY', ''), {
  apiVersion: '2025-10-29.clover',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, priceId, quantity = 1, metadata = {}, unauth = false, email, returnUrl: explicitReturnUrl, promoCode } = body as { type: string; priceId?: string; quantity?: number; metadata?: Record<string, string>; unauth?: boolean; email?: string; returnUrl?: string; promoCode?: string };

    // If explicitReturnUrl is not provided, try to get returnTo from referer URL
    // This handles the multi-step flow: Generation → Upgrade/Top-up?returnTo=... → Checkout
    let effectiveReturnUrl = explicitReturnUrl
    if (!effectiveReturnUrl && request.headers.get('referer')) {
      try {
        const refererUrl = new URL(request.headers.get('referer')!)
        const returnToParam = refererUrl.searchParams.get('returnTo')
        if (returnToParam) {
          effectiveReturnUrl = decodeURIComponent(returnToParam)
        }
      } catch {}
    }

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
      if (type === 'top_up') {
        // Block top-ups for free plan users - they should buy a plan instead
        const planPeriod = (user as unknown as { planPeriod?: string | null })?.planPeriod
        // isFreePlan handles tryOnce/try_once legacy periods
        if (!planPeriod || planPeriod === 'free' || planPeriod === 'tryOnce' || planPeriod === 'try_once') {
          return NextResponse.json({ error: 'TOP_UP_NOT_ALLOWED_ON_FREE' }, { status: 400 })
        }
      }
    }

    // Determine the base URL dynamically from the request
    // This allows the same deployment to serve multiple domains
    // Note: Stripe webhooks must point to HTTPS (https://app.teamshotspro.com/api/stripe/webhook)
    const baseUrl = getBaseUrl(request.headers)

    // Extract the domain for storing in Stripe metadata (used by webhook for emails)
    const checkoutDomain = new URL(baseUrl).hostname
    
    // Prefer returning to the page that initiated checkout. Accept explicit body.returnUrl or Referer header.
    // Validate to prevent open redirects: must start with our baseUrl; otherwise, fall back to dashboard.
    const requestedReturnUrl = (body as Record<string, unknown>)?.returnUrl as string | undefined;
    const referer = request.headers.get('referer') || undefined;
    const preferredReturnUrl = requestedReturnUrl || referer || '';
    
    // Extract locale from referer or use default
    let locale = 'en';
    try {
      if (preferredReturnUrl) {
        const url = new URL(preferredReturnUrl);
        const pathParts = url.pathname.split('/').filter(Boolean);
        // Check if first part is a locale (en or es)
        if (pathParts[0] === 'en' || pathParts[0] === 'es') {
          locale = pathParts[0];
        }
      }
    } catch {}
    
    // Check if checkout was initiated from upgrade or top-up pages
    // We'll use this to set finalDestination=dashboard, but still return to the page to show success screen
    let isFromUpgradeOrTopUp = false;
    
    // Determine the return URL - always return to the page that initiated checkout
    // (so success screens can show), but we'll add finalDestination param for post-success redirect
    let safeReturnUrl = `${baseUrl}/${locale}/app/dashboard`;
    try {
      if (preferredReturnUrl && preferredReturnUrl.startsWith(baseUrl)) {
        // Strip hash to avoid losing search params when we add ours
        const urlWithoutHash = preferredReturnUrl.split('#')[0];
        // Ensure locale is present in the URL
        const url = new URL(urlWithoutHash);
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts[0] !== 'en' && pathParts[0] !== 'es') {
          // Insert locale if missing
          url.pathname = `/${locale}${url.pathname}`;
        }
        safeReturnUrl = url.toString();
        
        // Check if checkout was initiated from upgrade or top-up pages
        // Remove locale if present to check the actual route
        const routePath = pathParts[0] === 'en' || pathParts[0] === 'es' 
          ? pathParts.slice(1).join('/')
          : pathParts.join('/');
        
        // If initiated from upgrade or top-up, mark it but still return to that page
        if (routePath === 'app/upgrade' || routePath === 'app/top-up') {
          isFromUpgradeOrTopUp = true;
        }
      }
    } catch {}

    // Helper to append query parameters
    const withParams = (url: string, params: Record<string, string>) => {
      const u = new URL(url);
      // Strip existing query params to avoid stale flags (e.g., canceled=true)
      u.search = ''
      Object.entries(params).forEach(([k, v]: [string, string | undefined]) => {
        if (typeof v === 'string' && v.length) {
          u.searchParams.set(k, v);
        }
      });
      return u.toString();
    };

    // Check if user is a team admin with existing seats (for seats isTopUp detection)
    // We check if they're an admin because we only want to show "additional seats" 
    // if THEY previously purchased seats, not if they were invited to someone else's team
    let seatsIsTopUp = false;
    if (type === 'seats' && user?.id) {
      const person = await prisma.person.findUnique({
        where: { userId: user.id },
        select: { 
          teamId: true,
          team: {
            select: {
              adminId: true,
              totalSeats: true
            }
          }
        }
      });
      // Only consider it a top-up if:
      // 1. They have a team AND
      // 2. They are the admin of that team AND
      // 3. The team already has seats (totalSeats > 0)
      seatsIsTopUp = !!(person?.teamId && person?.team?.adminId === user.id && (person?.team?.totalSeats ?? 0) > 0);
    }

    // Validate promo code if provided
    let validatedPromoCode: {
      promoCodeId?: string
      stripePromoCodeId?: string
      discount?: { type: 'percentage' | 'fixed_amount'; value: number; discountAmount: number; finalAmount: number }
      originalAmount?: number
    } | null = null
    if (promoCode) {
      const brand = getBrand(request.headers)
      const domain = brand.domain

      // Calculate the amount for validation
      let validationAmount = 0
      if (type === 'plan' && priceId) {
        if (priceId === PRICING_CONFIG.individual.stripePriceId) {
          validationAmount = PRICING_CONFIG.individual.price
        } else if (priceId === PRICING_CONFIG.vip.stripePriceId) {
          validationAmount = PRICING_CONFIG.vip.price
        }
      } else if (type === 'seats') {
        validationAmount = PRICING_CONFIG.seats.calculateTotal(quantity)
      } else if (type === 'top_up') {
        const tier = (metadata as { tier?: string })?.tier
        validationAmount = tier === 'vip'
          ? PRICING_CONFIG.vip.topUp.price
          : PRICING_CONFIG.individual.topUp.price
      }

      const promoValidation = await validatePromoCode({
        code: promoCode,
        domain,
        purchaseType: type as PurchaseType,
        originalAmount: validationAmount,
        userId: user?.id,
        email: user?.email || email,
        seats: type === 'seats' ? quantity : undefined,
      })

      if (!promoValidation.valid) {
        return NextResponse.json({ error: promoValidation.error || 'Invalid promo code' }, { status: 400 })
      }

      // Store promo code info - we'll apply discounts server-side via price_data
      validatedPromoCode = {
        promoCodeId: promoValidation.promoCode?.id,
        stripePromoCodeId: promoValidation.promoCode?.stripePromoCodeId ?? undefined,
        discount: promoValidation.discount,
        originalAmount: validationAmount,
      }
    }

    // Create specific success messages based on purchase type
    let successMessage = ''
    let successTier = ''
    if (type === 'plan') {
      // Determine tier and period from price ID
      if (priceId === PRICING_CONFIG.individual.stripePriceId) {
        successMessage = 'individual_success'
        successTier = 'individual' // For metadata - actual tier will be 'individual', period 'small'
      } else if (priceId === PRICING_CONFIG.vip.stripePriceId) {
        successMessage = 'vip_success'
        successTier = 'vip' // For metadata - actual tier will be 'individual', period 'large'
      }
    } else if (type === 'top_up') {
      successMessage = 'top_up_success'
    } else if (type === 'seats') {
      successMessage = 'seats_success'
    }
    
    // Use successTier (determined from priceId) for success URL
    const queryExtras: Record<string, string> = {}
    
    if (type === 'plan' && successTier) {
      queryExtras.tier = encodeURIComponent(successTier)
    }
    
    // For top-ups, calculate and pass credits amount
    if (type === 'top_up') {
      const { tier, credits: requestedCredits } = metadata as { tier?: string; credits?: number };
      let creditsPerPackage = 0;
      if (tier === 'vip') {
        creditsPerPackage = PRICING_CONFIG.vip.topUp.credits;
      } else {
        // Default to individual top-up (covers individual tier and legacy tiers)
        creditsPerPackage = PRICING_CONFIG.individual.topUp.credits;
      }
      const totalCredits = typeof requestedCredits === 'number' 
        ? Math.max(creditsPerPackage, Math.ceil(requestedCredits / creditsPerPackage) * creditsPerPackage)
        : creditsPerPackage;
      queryExtras.credits = String(totalCredits)
      queryExtras.tier = encodeURIComponent(tier || 'individual')
    }
    
    // For seats, pass seats count and isTopUp flag
    if (type === 'seats') {
      queryExtras.seats = String(quantity)
      queryExtras.isTopUp = String(seatsIsTopUp)
    }

    // Add redirect parameters:
    // - If effective returnUrl provided (explicit or from referer), redirect directly to it with success params
    // - If from upgrade/top-up without effective returnUrl: show success on upgrade/top-up page, then redirect to dashboard
    // - If from elsewhere: return to origin page with success params
    
    let finalSuccessUrl: string
    
    if (effectiveReturnUrl && effectiveReturnUrl.trim()) {
      // User came from another page (e.g., generation) via upgrade/top-up with returnTo parameter
      // Skip the intermediate success screen and go directly to the destination with success params
      const isAbsoluteUrl = effectiveReturnUrl.startsWith(baseUrl)
      const isRelativePath = effectiveReturnUrl.startsWith('/')

      if (isAbsoluteUrl || isRelativePath) {
        // Build the final destination URL with success parameters
        const destinationUrl = isRelativePath 
          ? `${baseUrl}${effectiveReturnUrl.startsWith('/') ? '' : '/'}${effectiveReturnUrl}`
          : effectiveReturnUrl
        
        // We're going directly to the final destination, so we need to tell PurchaseSuccess
        // that we're already at the destination by NOT including returnTo
        // Instead, we indicate we should stay here by setting a flag in the URL
        const finalQueryExtras = { ...queryExtras }
        delete finalQueryExtras.returnTo // Remove returnTo since we're already at the destination
        
        finalSuccessUrl = withParams(destinationUrl, { success: 'true', type: successMessage, ...finalQueryExtras })
      } else {
        // Invalid returnUrl, fallback to upgrade/top-up page
        finalSuccessUrl = withParams(safeReturnUrl, { success: 'true', type: successMessage, ...queryExtras })
      }
    } else if (isFromUpgradeOrTopUp) {
      // Direct purchase from upgrade/top-up without returnTo - show success there, then go to dashboard
      queryExtras.finalDestination = 'dashboard'
      finalSuccessUrl = withParams(safeReturnUrl, { success: 'true', type: successMessage, ...queryExtras })
    } else {
      // From other pages - return to origin
      finalSuccessUrl = withParams(safeReturnUrl, { success: 'true', type: successMessage, ...queryExtras })
    }

    const successUrl = unauth
      ? `${baseUrl}/auth/verify?checkout_session_id={CHECKOUT_SESSION_ID}&type=${successMessage}${type === 'plan' && successTier ? `&tier=${encodeURIComponent(successTier)}` : ''}`
      : finalSuccessUrl

    const cancelUrl = unauth
      ? `${baseUrl}/auth/signup?canceled=true`
      : withParams(safeReturnUrl, { canceled: 'true' })

    // Build checkout session parameters
    // Note: We apply discounts server-side via price_data, not via Stripe's discount system
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      customer_email: unauth ? (email as string | undefined) : undefined,
      payment_method_types: ['card'],
      mode: 'payment', // All purchases are now one-time payments
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ...(user?.id ? { userId: user.id } : {}),
        type,
        checkoutDomain, // Store the domain for webhook to use in emails
        ...metadata,
        ...(validatedPromoCode?.promoCodeId ? { promoCodeId: validatedPromoCode.promoCodeId, promoCode } : {}),
        ...(validatedPromoCode?.discount ? {
          discountType: validatedPromoCode.discount.type,
          discountValue: String(validatedPromoCode.discount.value),
          discountAmount: String(validatedPromoCode.discount.discountAmount),
          originalAmount: String(validatedPromoCode.originalAmount),
        } : {}),
      },
    };

    // Add line items based on type
    if (type === 'plan') {
      // Determine plan details from price ID
      let planTier: PlanTier | null = null
      let planPeriod: PlanPeriod | null = null
      let planName = ''
      let planDescription = ''
      let originalPrice = 0

      if (priceId === PRICING_CONFIG.individual.stripePriceId) {
        planTier = 'individual'
        planPeriod = 'small'
        planName = 'PhotoShots - Individual Plan'
        planDescription = 'Professional AI headshots'
        originalPrice = PRICING_CONFIG.individual.price
      } else if (priceId === PRICING_CONFIG.vip.stripePriceId) {
        planTier = 'individual'
        planPeriod = 'large'
        planName = 'PhotoShots - VIP Plan'
        planDescription = 'Premium professional AI headshots'
        originalPrice = PRICING_CONFIG.vip.price
      }

      // If promo code is applied, use price_data with discounted price
      // Otherwise, use the predefined Stripe price ID
      if (validatedPromoCode?.discount && originalPrice > 0) {
        const finalPrice = validatedPromoCode.discount.finalAmount
        sessionParams.line_items = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: planName,
                description: `${planDescription} (${validatedPromoCode.discount.value}${validatedPromoCode.discount.type === 'percentage' ? '%' : '$'} discount applied)`,
              },
              unit_amount: Math.round(finalPrice * 100), // Convert to cents
            },
            quantity,
          },
        ];
      } else if (priceId) {
        // No promo code - use predefined Stripe price
        sessionParams.line_items = [
          {
            price: priceId,
            quantity,
          },
        ];
      }

      if (planTier && planPeriod) {
        sessionParams.metadata = {
          ...sessionParams.metadata,
          planTier,
          planPeriod,
        }
      }
    } else if (type === 'top_up') {
      // For top-ups, create a one-time payment. Support tiers: 'individual' | 'vip'
      const { tier, credits } = metadata as { tier?: string; credits?: number };
      // Allow repeat purchases of top-ups; no one-per-tier restriction
      let pricePerPackage = 0;
      let creditsPerPackage = 0;
      if (tier === 'vip') {
        pricePerPackage = PRICING_CONFIG.vip.topUp.price;
        creditsPerPackage = PRICING_CONFIG.vip.topUp.credits;
      } else {
        // Default to individual top-up (covers individual tier and legacy tiers)
        pricePerPackage = PRICING_CONFIG.individual.topUp.price;
        creditsPerPackage = PRICING_CONFIG.individual.topUp.credits;
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
        tier: tier || 'individual',
        credits: String(totalCredits),
      };
    } else if (type === 'seats') {
      // Seats-based pricing with graduated pricing (calculated server-side)
      // Graduated pricing is not supported by Stripe for one-time payments,
      // so we calculate the total cost here and use price_data

      // Validate minimum seats based on purchase type
      // First purchase: minimum 2 seats required
      // Additional seats: minimum 1 seat (no restriction)
      if (!seatsIsTopUp && quantity < PRICING_CONFIG.seats.minSeats) {
        throw new Error(`Minimum ${PRICING_CONFIG.seats.minSeats} seats required for first purchase`);
      }
      if (quantity < 1) {
        throw new Error('At least 1 seat required');
      }

      // Calculate graduated price using config
      const totalCost = PRICING_CONFIG.seats.calculateTotal(quantity);
      const photosPerSeat = PRICING_CONFIG.seats.creditsPerSeat / PRICING_CONFIG.credits.perGeneration;
      const totalPhotos = quantity * photosPerSeat;

      sessionParams.line_items = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `TeamShots - ${quantity} Seat${quantity === 1 ? '' : 's'}`,
              description: `Professional headshots for your team (${totalPhotos} photos total with graduated pricing)`,
              metadata: {
                type: 'team_seats',
                seats: String(quantity),
                credits_per_seat: String(PRICING_CONFIG.seats.creditsPerSeat),
                photos_per_seat: String(photosPerSeat),
              }
            },
            unit_amount: Math.round(totalCost * 100), // Convert to cents
          },
          quantity: 1, // Quantity is 1 because the price already includes all seats
        },
      ];

      sessionParams.metadata = {
        ...sessionParams.metadata,
        seats: String(quantity),
        totalCost: String(totalCost),
        planTier: 'pro',
        planPeriod: 'seats',
        isTopUp: String(seatsIsTopUp),
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

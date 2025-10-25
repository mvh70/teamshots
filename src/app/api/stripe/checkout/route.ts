import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PRICING_CONFIG } from '@/config/pricing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, priceId, quantity = 1, metadata = {} } = body;

    // Get user from database to check for existing Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create or retrieve Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      
      // Save Stripe customer ID to user
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      });
      
      stripeCustomerId = customer.id;
    }

    // Determine the base URL with fallback - force HTTP for local development
    // Note: Stripe webhooks must point to HTTPS (https://app.teamshots.vip/api/stripe/webhook)
    // but local redirects should use HTTP (https://localhost:3000)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    
    // Create specific success messages based on purchase type
    let successMessage = ''
    if (type === 'try_once') {
      successMessage = 'try_once_success'
    } else if (type === 'subscription') {
      const tier = priceId === process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID || 
                   priceId === process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID ? 'individual' : 'pro'
      successMessage = tier === 'individual' ? 'individual_success' : 'pro_success'
    } else if (type === 'top_up') {
      successMessage = 'top_up_success'
    }
    
    const successUrl = `${baseUrl}/en/app/dashboard?success=true&type=${successMessage}`
    const cancelUrl = `${baseUrl}/en/app/settings?canceled=true`

    // Build checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      mode: type === 'try_once' || type === 'top_up' ? 'payment' : 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
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
      // For top-ups, create a custom one-time payment
      const { tier, credits } = metadata;
      const topUpPrice = tier === 'individual' 
        ? PRICING_CONFIG.individual.topUp.pricePerPackage
        : PRICING_CONFIG.pro.topUp.pricePerPackage;
      const topUpCredits = tier === 'individual'
        ? PRICING_CONFIG.individual.topUp.creditsPerPackage
        : PRICING_CONFIG.pro.topUp.creditsPerPackage;

      sessionParams.line_items = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Credit Top-Up (${credits} credits)`,
              description: `Add ${credits} credits to your account`,
            },
            unit_amount: Math.round(topUpPrice * quantity * 100), // Convert to cents
          },
          quantity: Math.ceil(credits / topUpCredits),
        },
      ];
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    
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

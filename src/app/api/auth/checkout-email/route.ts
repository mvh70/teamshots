import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Env } from '@/lib/env'
import { badRequest, internal, ok } from '@/lib/api-response'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { RATE_LIMITS } from '@/config/rate-limit-config'
import { Logger } from '@/lib/logger'

// Force this route to be dynamic (skip static generation)
export const dynamic = 'force-dynamic'

const stripe = new Stripe(Env.string('STRIPE_SECRET_KEY', ''), {
  apiVersion: '2025-10-29.clover',
})

/**
 * Fetch customer email from a Stripe checkout session.
 * Used for guest checkout flow to get the email for OTP verification.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting to prevent enumeration attacks
    const identifier = await getRateLimitIdentifier(request, 'checkout-email')
    const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.checkoutEmail.limit, RATE_LIMITS.checkoutEmail.window)

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) } }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        badRequest('MISSING_SESSION_ID', 'errors.invalidInput', 'Session ID is required'),
        { status: 400 }
      )
    }

    // Validate session ID format (Stripe session IDs start with cs_)
    if (!sessionId.startsWith('cs_')) {
      return NextResponse.json(
        badRequest('INVALID_SESSION_ID', 'errors.invalidInput', 'Invalid session ID format'),
        { status: 400 }
      )
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Verify payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        badRequest('PAYMENT_NOT_COMPLETED', 'errors.paymentNotCompleted', 'Payment has not been completed'),
        { status: 400 }
      )
    }

    // Get email from customer_details (collected during checkout)
    const email = session.customer_details?.email

    if (!email) {
      return NextResponse.json(
        badRequest('EMAIL_NOT_FOUND', 'errors.emailNotFound', 'Email not found in checkout session'),
        { status: 400 }
      )
    }

    // Return the email and tier information
    const planTier = session.metadata?.planTier || null
    const planPeriod = session.metadata?.planPeriod || null

    return NextResponse.json(
      ok({ email, planTier, planPeriod }, 'EMAIL_RETRIEVED', 'Email retrieved successfully')
    )
  } catch (error) {
    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      if (error.code === 'resource_missing') {
        return NextResponse.json(
          badRequest('SESSION_NOT_FOUND', 'errors.sessionNotFound', 'Checkout session not found'),
          { status: 404 }
        )
      }
      Logger.error('Stripe error in checkout-email endpoint', { 
        error: error.message,
        code: error.code 
      })
    } else {
      Logger.error('Error in checkout-email endpoint', { 
        error: error instanceof Error ? error.message : String(error) 
      })
    }
    
    return NextResponse.json(
      internal('Failed to retrieve checkout session', 'errors.internal'),
      { status: 500 }
    )
  }
}


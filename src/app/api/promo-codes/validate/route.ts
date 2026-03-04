import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { validatePromoCode, type PurchaseType } from '@/domain/pricing/promo-codes'
import { getTenantFromRequest } from '@/config/tenant-server'
import { Logger } from '@/lib/logger'
import { z } from 'zod'

export const runtime = 'nodejs'

const validateSchema = z.object({
  code: z.string().min(1, 'Promo code is required'),
  type: z.enum(['plan', 'seats', 'top_up']),
  amount: z.number().positive(),
  seats: z.number().int().positive().optional(),
})

function isAbortLikeError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : ''
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  return (
    code === 'ECONNRESET' ||
    message.includes('aborted') ||
    message.includes('operation was aborted') ||
    message.includes('unexpected end of json input')
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const parseResult = validateSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { valid: false, error: parseResult.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      )
    }

    const { code, type, amount, seats } = parseResult.data

    const tenant = getTenantFromRequest(request)
    const domain = tenant.domain

    // Get user session (optional - for checking if user already used the code)
    const session = await auth()
    const userId = session?.user?.id
    const userEmail = session?.user?.email

    // Validate the promo code
    const result = await validatePromoCode({
      code,
      domain,
      purchaseType: type as PurchaseType,
      originalAmount: amount,
      userId,
      email: userEmail || undefined,
      seats,
    })

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 200 } // Return 200 even for invalid codes (not a server error)
      )
    }

    // Return success with discount details
    // stripePromoCodeId is optional - discounts are applied server-side via price_data
    return NextResponse.json({
      valid: true,
      discount: result.discount,
      stripePromoCodeId: result.promoCode?.stripePromoCodeId,
    })
  } catch (error) {
    if (isAbortLikeError(error)) {
      Logger.warn('Promo validation request aborted by client', {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json(
        { valid: false, error: 'Request aborted' },
        { status: 400 }
      )
    }
    Logger.error('Error validating promo code', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { valid: false, error: 'Failed to validate promo code' },
      { status: 500 }
    )
  }
}

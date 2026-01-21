import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateZapierApiKey, createZapierInvite } from '@/domain/integrations/zapier'
import { SecurityLogger } from '@/lib/security-logger'
import { Logger } from '@/lib/logger'
import { getBaseUrl } from '@/lib/url'
import { getRequestIp } from '@/lib/server-headers'

const inviteRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  api_key: z.string().min(1, 'API key is required')
})

/**
 * POST /api/integrations/zapier/invite
 * Public webhook endpoint for Zapier to create team member invites
 *
 * Authentication: Via api_key in request body
 * Rate Limit: 60 requests/minute per API key (recommended to implement)
 */
export async function POST(request: NextRequest) {
  const ipAddress = await getRequestIp()

  try {
    // Parse and validate request body
    const body = await request.json()
    const parseResult = inviteRequestSchema.safeParse(body)

    if (!parseResult.success) {
      const errors = parseResult.error.flatten().fieldErrors
      const errorMessage = Object.entries(errors)
        .map(([field, msgs]) => `${field}: ${msgs?.join(', ')}`)
        .join('; ')

      return NextResponse.json(
        {
          success: false,
          error: errorMessage || 'Invalid request data',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    const { email, first_name, last_name, api_key } = parseResult.data

    // Validate API key
    const keyValidation = await validateZapierApiKey(api_key, ipAddress)

    if (!keyValidation.valid || !keyValidation.team) {
      await SecurityLogger.logSuspiciousActivity(
        null,
        'Invalid Zapier API key attempt',
        {
          email,
          error: keyValidation.error,
          ipAddress
        }
      )

      return NextResponse.json(
        {
          success: false,
          error: keyValidation.error || 'Invalid API key',
          code: 'INVALID_API_KEY'
        },
        { status: 401 }
      )
    }

    const team = keyValidation.team
    const baseUrl = getBaseUrl(request.headers)

    // Create the invite
    const result = await createZapierInvite({
      teamId: team.id,
      email,
      firstName: first_name,
      lastName: last_name,
      baseUrl,
      ipAddress
    })

    if (!result.success || !result.invite) {
      Logger.warn('Zapier invite creation failed', {
        teamId: team.id,
        email,
        error: result.error,
        errorCode: result.errorCode
      })

      // Map error codes to appropriate HTTP status codes
      const statusCode = result.errorCode === 'INVITE_EXISTS' ||
                        result.errorCode === 'ALREADY_MEMBER'
        ? 409 // Conflict
        : result.errorCode === 'NO_AVAILABLE_SEATS'
        ? 402 // Payment Required
        : result.errorCode === 'NO_ACTIVE_CONTEXT'
        ? 400 // Bad Request
        : 500

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: result.errorCode || 'CREATE_FAILED'
        },
        { status: statusCode }
      )
    }

    Logger.info('Zapier invite created successfully', {
      teamId: team.id,
      inviteId: result.invite.id,
      email: result.invite.email
    })

    return NextResponse.json({
      success: true,
      invite_id: result.invite.id,
      email: result.invite.email,
      first_name: result.invite.firstName,
      status: result.invite.status,
      invite_url: result.invite.inviteLink
    })

  } catch (error) {
    Logger.error('Zapier invite endpoint error', {
      error: error instanceof Error ? error.message : String(error),
      ipAddress
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  })
}

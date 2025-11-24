import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createOrUpdateStyleServer, setActiveStyleServer } from '../_service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    scope: 'individual' | 'pro' | 'freePackage'
    contextId?: string | null
    packageId: string
    stylePreset: string
    settings: Record<string, unknown>
    name?: string
  }

  try {
    const result = await createOrUpdateStyleServer({
      scope: body.scope,
      userId: session.user.id,
      styleId: body.contextId || null,
      packageId: body.packageId,
      settings: body.settings,
      name: body.name
    })

    // Maintain prior behavior of setting active for certain scopes
    await setActiveStyleServer({ scope: body.scope, userId: session.user.id, styleId: result.id })

    return NextResponse.json({ success: true, contextId: result.id })
  } catch {
    return NextResponse.json({ error: 'Failed to save style' }, { status: 500 })
  }
}



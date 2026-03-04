import { NextRequest, NextResponse } from 'next/server'
import { resolveInviteAccess } from '@/lib/invite-access'
import {
  getBeautificationDefaultsResponse,
  putBeautificationDefaultsResponse,
} from '@/domain/person/beautification-handlers'

export const runtime = 'nodejs'

async function resolveInvite(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  return resolveInviteAccess({ token })
}

export async function GET(request: NextRequest) {
  const inviteAccess = await resolveInvite(request)
  if (!inviteAccess.ok) {
    return NextResponse.json({ error: inviteAccess.error.message }, { status: inviteAccess.error.status })
  }

  return getBeautificationDefaultsResponse(inviteAccess.access.person.id)
}

export async function PUT(request: NextRequest) {
  const inviteAccess = await resolveInvite(request)
  if (!inviteAccess.ok) {
    return NextResponse.json({ error: inviteAccess.error.message }, { status: inviteAccess.error.status })
  }

  return putBeautificationDefaultsResponse(inviteAccess.access.person.id, request)
}

import { NextRequest, NextResponse } from 'next/server'
import { resolveInviteAccess } from '@/lib/invite-access'
import { buildDemographicsResponse } from '@/domain/person/demographics-handlers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const inviteAccess = await resolveInviteAccess({ token })
  if (!inviteAccess.ok) {
    return NextResponse.json({ error: inviteAccess.error.message }, { status: inviteAccess.error.status })
  }

  const personId = inviteAccess.access.person.id
  const payload = await buildDemographicsResponse(
    personId,
    searchParams,
    'team-member-accessories',
    'team/member/demographics'
  )

  return NextResponse.json(payload)
}

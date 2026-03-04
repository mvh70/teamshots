import { NextRequest, NextResponse } from 'next/server'
import { resolveInviteAccess } from '@/lib/invite-access'
import { buildAccessoriesResponse } from '@/domain/person/accessories-handlers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const inviteAccess = await resolveInviteAccess({ token })
  if (!inviteAccess.ok) {
    return NextResponse.json({ error: inviteAccess.error.message }, { status: inviteAccess.error.status })
  }

  const personId = inviteAccess.access.person.id
  const { accessories, pendingReanalysisCount } = await buildAccessoriesResponse(
    personId,
    searchParams,
    'team-member-accessories',
    'team/member/accessories'
  )
  return NextResponse.json({ accessories, pendingReanalysisCount })
}

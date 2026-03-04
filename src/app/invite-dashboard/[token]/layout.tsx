import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { resolveInviteAccess } from '@/lib/invite-access'

export default async function InviteTokenLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const inviteAccess = await resolveInviteAccess({ token, extendExpiry: false })

  if (!inviteAccess.ok) {
    redirect('/invite-expired')
  }

  return children
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getUserCreditBalance, getCompanyCreditBalance } from '@/lib/credits'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'individual' or 'company'

    if (type === 'individual') {
      // Get individual credits for the user
      const balance = await getUserCreditBalance(session.user.id)
      return NextResponse.json({ balance })
    } else if (type === 'company') {
      // Get company credits for the user's company
      if (!session.user.person?.companyId) {
        return NextResponse.json({ balance: 0 })
      }
      const balance = await getCompanyCreditBalance(session.user.person.companyId)
      return NextResponse.json({ balance })
    } else {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error fetching credit balance:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

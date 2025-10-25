import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getUserWithRoles } from '@/lib/roles'

export async function POST() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get fresh user data from database
    const userWithRoles = await getUserWithRoles(session.user.id)
    
    console.log('getUserWithRoles result:', userWithRoles)
    
    if (!userWithRoles) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Return the fresh user data with debug info
    return NextResponse.json({
      success: true,
      user: {
        id: userWithRoles.id,
        email: userWithRoles.email,
        role: userWithRoles.role,
        isAdmin: userWithRoles.isAdmin,
        person: userWithRoles.person
      },
      debug: {
        databaseRole: userWithRoles.role,
        hasPerson: !!userWithRoles.person,
        companyId: userWithRoles.person?.companyId,
        isCompanyAdmin: userWithRoles.person?.company?.adminId === userWithRoles.id
      },
      requiresReauth: true // Indicate that session needs to be refreshed
    })

  } catch (error) {
    console.error('Error refreshing session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

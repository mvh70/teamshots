import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/search-users?query=xxx
 * Search for users by first name, last name, or email (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    // Check if user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is platform admin
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Permission denied. Only platform administrators can search users.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
    }

    // Search users by email or person name
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            isAdmin: false // Don't show other admins
          },
          {
            OR: [
              {
                email: {
                  contains: query,
                  mode: 'insensitive'
                }
              },
              {
                person: {
                  OR: [
                    {
                      firstName: {
                        contains: query,
                        mode: 'insensitive'
                      }
                    },
                    {
                      lastName: {
                        contains: query,
                        mode: 'insensitive'
                      }
                    },
                    {
                      email: {
                        contains: query,
                        mode: 'insensitive'
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      },
      select: {
        id: true,
        email: true,
        person: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      take: 10 // Limit to 10 results
    })

    // Format the results
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.person?.firstName || '',
      lastName: user.person?.lastName || '',
      displayName: user.person 
        ? `${user.person.firstName}${user.person.lastName ? ' ' + user.person.lastName : ''} (${user.email})`
        : user.email
    }))

    return NextResponse.json({ 
      success: true,
      users: formattedUsers
    })
  } catch (error) {
    console.error('Error searching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


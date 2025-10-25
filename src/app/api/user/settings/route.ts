import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user with their company info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            company: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Determine mode and company info
    const isCompanyMode = !!user.person?.company
    const settings = {
      mode: isCompanyMode ? 'company' as const : 'individual' as const,
      companyName: user.person?.company?.name || undefined,
      companyWebsite: user.person?.company?.website || undefined,
      isAdmin: user.person?.company?.adminId === user.id
    }

    return NextResponse.json({ settings })

  } catch (error) {
    console.error('Error fetching user settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const { mode, companyName, companyWebsite } = await request.json()

      if (!mode || !['individual', 'company'].includes(mode)) {
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
      }

      // Get current user with their person record
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          person: {
            include: {
              company: true
            }
          }
        }
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (mode === 'company') {
        // Switching to company mode - create or update company
        if (!companyName) {
          return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
        }

          let company

          if (user.person?.company) {
            // User already has a company, update it
            company = await prisma.company.update({
              where: { id: user.person.company.id },
              data: {
                name: companyName,
                website: companyWebsite || null
              }
            })

            // Ensure user role is company_admin if they're the admin
            if (company.adminId === user.id && user.role !== 'company_admin') {
              await prisma.user.update({
                where: { id: user.id },
                data: { role: 'company_admin' }
              })
            }
          } else {
            // Create new company and link user as admin
            company = await prisma.company.create({
              data: {
                name: companyName,
                website: companyWebsite || null,
                adminId: user.id
              }
            })

            // Update user role to company_admin
            await prisma.user.update({
              where: { id: user.id },
              data: { role: 'company_admin' }
            })

            if (user.person) {
              // Link existing person to company
              await prisma.person.update({
                where: { id: user.person.id },
                data: { companyId: company.id }
              })
            } else {
              // Create new person record linked to company
              await prisma.person.create({
                data: {
                  firstName: session.user.name?.split(' ')[0] || 'User',
                  lastName: session.user.name?.split(' ').slice(1).join(' ') || null,
                  email: session.user.email!,
                  userId: user.id,
                  companyId: company.id
                }
              })
            }
          }

        return NextResponse.json({
          settings: {
            mode: 'company' as const,
            companyName: company.name,
            companyWebsite: company.website,
            isAdmin: company.adminId === user.id
          }
        })

      } else {
        // Switching to individual mode - remove company association
        if (user.person?.company) {
          // If user is admin of a company with other members, prevent switching
          const companyWithMembers = await prisma.company.findFirst({
            where: { 
              id: user.person.company.id,
              adminId: user.id
            },
            include: {
              teamMembers: {
                where: {
                  id: { not: user.person.id }
                }
              }
            }
          })

          if (companyWithMembers && companyWithMembers.teamMembers.length > 0) {
            return NextResponse.json({ 
              error: 'Cannot switch to individual mode while you are admin of a company with other members. Please remove all team members first.' 
            }, { status: 400 })
          }

          // Remove company association
          await prisma.person.update({
            where: { id: user.person.id },
            data: { companyId: null }
          })

          // If this was the admin's company and it's now empty, delete the company
          if (companyWithMembers?.adminId === user.id) {
            await prisma.company.delete({
              where: { id: user.person.company.id }
            })
          }
        }

        return NextResponse.json({
          settings: {
            mode: 'individual' as const,
            isAdmin: false
          }
        })
      }

    } catch {
      return NextResponse.json({ error: 'Invalid JSON input' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error updating user settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

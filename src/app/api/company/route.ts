import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, website } = body

    if (!name) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    // Find the user's person record
    const person = await prisma.person.findUnique({
      where: { userId: session.user.id }
    })

    if (!person) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }
    
    if (person.companyId) {
      return NextResponse.json({ error: 'User is already part of a company' }, { status: 400 })
    }

    // Create the company and connect the current user as the admin
    const company = await prisma.company.create({
      data: {
        name,
        website,
        adminId: session.user.id,
        teamMembers: {
          connect: {
            id: person.id
          }
        }
      },
    })

    // Also update the person record directly with the companyId
    await prisma.person.update({
      where: { id: person.id },
      data: { companyId: company.id }
    })

    return NextResponse.json({ success: true, companyId: company.id })
  } catch (error) {
    console.error('Error creating company:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

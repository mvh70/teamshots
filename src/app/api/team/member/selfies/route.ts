import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Validate the token and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      },
      include: {
        person: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    if (!invite.person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const person = invite.person

    // Get selfies for the person
    const selfies = await prisma.selfie.findMany({
      where: {
        personId: person.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform selfies to include URLs and proper field names
    const tokenParam = `token=${encodeURIComponent(token)}`

    const transformedSelfies = selfies.map(selfie => {
      const url = `/api/files/get?key=${encodeURIComponent(selfie.key)}&${tokenParam}`
      Logger.info('Generated selfie URL', { url, key: selfie.key })
      return {
        id: selfie.id,
        key: selfie.key,
        url,
        uploadedAt: selfie.createdAt.toISOString(),
        status: selfie.userApproved ? 'approved' : 'uploaded'
      }
    })

    return NextResponse.json({ selfies: transformedSelfies })
  } catch (error) {
    Logger.error('Error fetching selfies', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token, selfieKey } = await request.json()

    if (!token || !selfieKey) {
      return NextResponse.json({ error: 'Missing token or selfieKey' }, { status: 400 })
    }

    // Validate the token and get person data
    const invite = await prisma.teamInvite.findFirst({
      where: {
        token,
        usedAt: { not: null }
      },
      include: {
        person: true
      }
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 401 })
    }

    if (!invite.person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const person = invite.person

    // Create selfie record
    const selfie = await prisma.selfie.create({
      data: {
        personId: person.id,
        key: selfieKey,
        uploadedViaToken: token
      }
    })

    return NextResponse.json({ selfie })
  } catch (error) {
    Logger.error('Error creating selfie', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

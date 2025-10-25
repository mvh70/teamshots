import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

export async function createRefreshToken(
  userId: string,
  userAgent: string | null,
  ipAddress: string | null
) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  
  return await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
      userAgent,
      ipAddress,
    },
  })
}

export async function validateRefreshToken(token: string) {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  })
  
  if (!refreshToken || refreshToken.revokedAt || refreshToken.expiresAt < new Date()) {
    return null
  }
  
  return refreshToken
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.update({
    where: { token },
    data: { revokedAt: new Date() },
  })
}

export async function revokeAllUserTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

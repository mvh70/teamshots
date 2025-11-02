import { test, expect } from '@playwright/test'
import { PrismaClient, Prisma } from '@prisma/client'

test.describe('Free plan forces free package style', () => {
  let prisma: PrismaClient

  test.beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/teamshots_test?schema=public'
        }
      }
    })
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('generation uses AppSetting.freePackageStyleId for free user', async ({ page }) => {
    // Prepare: pick any existing context as the free style (or create one)
    let ctx = await prisma.context.findFirst()
    if (!ctx) {
      ctx = await prisma.context.create({ data: { name: 'free-style', stylePreset: 'corporate' } })
    }
    type PrismaWithAppSetting = PrismaClient & { appSetting: { upsert: (...args: unknown[]) => Promise<unknown> } }
    const prismaEx = prisma as unknown as PrismaWithAppSetting
    await prismaEx.appSetting.upsert({
      where: { key: 'freePackageStyleId' },
      update: { value: ctx.id },
      create: { key: 'freePackageStyleId', value: ctx.id },
    })

    // Create a free user with a selfie
    const user = await prisma.user.create({ data: { email: `freeuser-${Date.now()}@example.com`, locale: 'en' } })
    const person = await prisma.person.create({ data: { firstName: 'Free', email: user.email, userId: user.id } })
    const selfie = await prisma.selfie.create({ data: { personId: person.id, key: `selfie-${Date.now()}` } })
    await prisma.user.update({ where: { id: user.id }, data: { planTier: 'free', planPeriod: 'none' } as Prisma.UserUpdateInput })

    // E2E auth headers
    await page.setExtraHTTPHeaders({
      'x-e2e-user-id': user.id,
      'x-e2e-user-email': user.email,
      'x-e2e-user-role': 'user',
      'x-e2e-user-locale': 'en'
    })

    // Call generation API directly
    const res = await page.request.post('https://localhost:3000/api/generations/create', {
      data: {
        selfieId: selfie.id,
        prompt: 'Corporate headshot',
        generationType: 'personal',
        creditSource: 'individual'
      }
    })
    expect(res.status()).toBeLessThan(400)
    const json = await res.json()
    expect(json.generationId).toBeTruthy()

    const gen = await prisma.generation.findUnique({ where: { id: json.generationId } })
    expect(gen?.contextId).toBe(ctx.id)
  })
})



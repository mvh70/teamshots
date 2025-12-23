import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Env } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: Env.string('DATABASE_URL'),
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: Env.string('NODE_ENV', 'development') === 'development' ? ['error', 'warn'] : ['error'],
  });

if (Env.string('NODE_ENV', 'development') !== 'production') globalForPrisma.prisma = prisma;

import { PrismaClient } from '@prisma/client';
import { Env } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: Env.string('NODE_ENV', 'development') === 'development' ? ['error', 'warn'] : ['error'],
  });

if (Env.string('NODE_ENV', 'development') !== 'production') globalForPrisma.prisma = prisma;

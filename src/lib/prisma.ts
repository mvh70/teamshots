import { PrismaClient } from '@prisma/client';

// NOTE: Environment validation removed from module level to fix build errors
// Validation should be done in middleware or at application startup instead

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Optional: Export a function to validate environment when needed
export async function validatePrismaEnvironment() {
  try {
    const { validateEnvironment } = await import('./env-validation');
    validateEnvironment();
  } catch (error) {
    console.error('Environment validation failed:', error);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}
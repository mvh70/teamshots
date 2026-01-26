import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL not set');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'mvhaperen70@gmail.com' },
    include: {
      person: {
        include: {
          team: true,
          selfies: { select: { id: true, createdAt: true } },
          generations: { select: { id: true, createdAt: true, status: true } }
        }
      }
    }
  });
  
  console.log('User:', JSON.stringify(user, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

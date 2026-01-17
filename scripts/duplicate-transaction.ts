import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function main() {
  // Get the original transaction
  const original = await prisma.creditTransaction.findUnique({
    where: { id: 'cmk0w9z9d001le0dqf5guhum1' }
  });
  console.log('Original:', JSON.stringify(original, null, 2));

  if (original) {
    // Create duplicate with new team
    const duplicate = await prisma.creditTransaction.create({
      data: {
        credits: original.credits,
        type: original.type,
        description: original.description,
        teamId: 'cmiwy062p0005dqj70ov7e1dz',
        personId: original.personId,
        userId: original.userId,
        teamInviteId: original.teamInviteId,
        relatedTransactionId: original.relatedTransactionId,
      }
    });
    console.log('Created duplicate:', JSON.stringify(duplicate, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

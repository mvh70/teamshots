import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debug() {
  // Find user
  const user = await prisma.user.findFirst({
    where: { email: { contains: 'mvhaperen70' } },
    include: {
      person: {
        include: {
          team: {
            include: {
              admin: true
            }
          }
        }
      }
    }
  });

  console.log('\n=== USER DEBUG ===');
  console.log('Email:', user?.email);
  console.log('signupDomain:', user?.signupDomain);
  console.log('planPeriod:', user?.planPeriod);
  console.log('planTier:', user?.planTier);

  console.log('\n=== TEAM DEBUG ===');
  console.log('Team ID:', user?.person?.team?.id);
  console.log('isLegacyCredits:', user?.person?.team?.isLegacyCredits);
  console.log('totalSeats:', user?.person?.team?.totalSeats);
  console.log('activeSeats:', user?.person?.team?.activeSeats);

  console.log('\n=== TEAM ADMIN DEBUG ===');
  console.log('Admin ID:', user?.person?.team?.admin?.id);
  console.log('Admin email:', user?.person?.team?.admin?.email);
  console.log('Admin signupDomain:', user?.person?.team?.admin?.signupDomain);

  console.log('\n=== IS SEATS MODEL CALCULATION ===');
  const isLegacyCredits = user?.person?.team?.isLegacyCredits ?? true;
  const adminSignupDomain = user?.person?.team?.admin?.signupDomain;
  const TEAM_DOMAIN = 'teamshotspro.com';

  console.log(`!isLegacyCredits: ${!isLegacyCredits}`);
  console.log(`adminSignupDomain === TEAM_DOMAIN: ${adminSignupDomain === TEAM_DOMAIN}`);
  console.log(`isSeatsModel: ${!isLegacyCredits && adminSignupDomain === TEAM_DOMAIN}`);

  await prisma.$disconnect();
}

debug();

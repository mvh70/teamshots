import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// Admin-only analytics endpoint
export async function GET() {
  try {
    const session = await auth()

    // Check if user is admin
    if (!session?.user?.role?.includes('admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get basic user counts
    const totalUsers = await prisma.user.count()
    const paidUsers = await prisma.user.count({
      where: {
        subscriptionStatus: 'active'
      }
    })

    // Calculate conversion rate
    const conversionRate = totalUsers > 0 ? paidUsers / totalUsers : 0

    // Calculate ARPU (simplified - total revenue / total users)
    // In a real implementation, you'd calculate this from actual payment data
    const arpu = 45.99 // Placeholder - would be calculated from actual data

    // Calculate onboarding completion rate
    // This would ideally come from PostHog data, but for now we'll use a placeholder
    const onboardingCompletionRate = 0.78 // Placeholder - would be calculated from funnel data

    // Helper to calculate average minutes
    const calculateAverageMinutes = (times: number[]) => {
      if (times.length === 0) return 0;
      const sum = times.reduce((a, b) => a + b, 0);
      return Math.round((sum / times.length) / (1000 * 60)); // ms to minutes
    };

    // Personal: time to first individual generation
    const personalFirstGens = await prisma.$queryRaw<Array<{id: string; regDate: Date; firstGen: Date }>>`
      SELECT 
        u.id,
        u."createdAt" as "regDate",
        MIN(g."createdAt") as "firstGen"
      FROM "User" u
      INNER JOIN "Person" p ON p."userId" = u.id
      INNER JOIN "Generation" g ON g."personId" = p.id
      WHERE g."creditSource" = 'individual'
      GROUP BY u.id
    `;

    const personalTimes = personalFirstGens.map((row: {id: string; regDate: Date; firstGen: Date }) => row.firstGen.getTime() - row.regDate.getTime());
    const personalTimeToFirstGen = calculateAverageMinutes(personalTimes);

    // Team admins
    const teamAdmins = await prisma.user.findMany({
      where: { teams: { some: {} } }, // admins with teams
      include: { 
        teams: true,
        person: { 
          include: { 
            generations: {
              where: { creditSource: 'team' },
              orderBy: { createdAt: 'asc' }
            } 
          } 
        } 
      }
    });

    // Time to first invite for each admin
    const teamInviteTimes = [];
    for (const admin of teamAdmins) {
      for (const team of admin.teams) {
        const firstInvite = await prisma.teamInvite.findFirst({
          where: { teamId: team.id },
          orderBy: { createdAt: 'asc' }
        });
        if (firstInvite) {
          teamInviteTimes.push(firstInvite.createdAt.getTime() - admin.createdAt.getTime());
        }
      }
    }
    const teamTimeToFirstInvite = calculateAverageMinutes(teamInviteTimes);

    // Time to first team generation for each admin
    type TeamAdmin = typeof teamAdmins[number];
    const teamGenTimes = teamAdmins
      .filter((admin: TeamAdmin) => (admin.person?.generations?.length ?? 0) > 0)
      .map((admin: TeamAdmin) => admin.person!.generations[0].createdAt.getTime() - admin.createdAt.getTime());

    const teamTimeToFirstGen = calculateAverageMinutes(teamGenTimes);

    return NextResponse.json({
      totalUsers,
      paidUsers,
      conversionRate,
      arpu,
      onboardingCompletionRate,
      personalTimeToFirstGen,
      teamTimeToFirstInvite,
      teamTimeToFirstGen,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to fetch admin analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}

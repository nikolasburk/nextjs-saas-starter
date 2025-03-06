import { prisma } from './prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: sessionData.user.id,
      deletedAt: null
    }
  });

  return user;
}

export async function getTeamByStripeCustomerId(customerId: string) {
  return await prisma.team.findUnique({
    where: { stripeCustomerId: customerId }
  });
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await prisma.team.update({
    where: { id: teamId },
    data: {
      ...subscriptionData,
      updatedAt: new Date(),
    }
  });
}

export async function getUserWithTeam(userId: number) {
  const result = await prisma.user.findFirst({
    where: { id: userId },
    include: {
      teamMembers: {
        select: {
          teamId: true
        }
      }
    }
  });

  if (!result) return null;

  return {
    user: result,
    teamId: result.teamMembers[0]?.teamId
  };
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await prisma.activityLog.findMany({
    select: {
      id: true,
      action: true,
      timestamp: true,
      ipAddress: true,
      user: {
        select: {
          name: true
        }
      }
    },
    where: { userId: user.id },
    orderBy: { timestamp: 'desc' },
    take: 10
  });
}

export async function getTeamForUser(userId: number) {
  const result = await prisma.user.findFirst({
    where: { id: userId },
    include: {
      teamMembers: {
        include: {
          team: {
            include: {
              teamMembers: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return result?.teamMembers[0]?.team || null;
}

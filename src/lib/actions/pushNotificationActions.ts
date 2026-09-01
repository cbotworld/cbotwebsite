'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPushNotifications, PushNotificationPayload } from '@/lib/push-notifications';

export async function getPushNotificationStats() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const role = (session.user as any)?.role;
  if (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN') {
    throw new Error('Permission denied.');
  }

  const totalTokensCount = await prisma.userPushToken.count();

  const userCountResult = await prisma.userPushToken.groupBy({
    by: ['userId'],
  });

  const iosCount = await prisma.userPushToken.count({ where: { platform: 'ios' } });
  const androidCount = await prisma.userPushToken.count({ where: { platform: 'android' } });

  return {
    totalTokens: totalTokensCount,
    usersCount: userCountResult.length,
    iosCount,
    androidCount,
  };
}

export async function sendCustomPushNotification(input: {
  title: string;
  message: string;
  target?: 'ALL' | 'PLAYERS' | 'CAPTAINS';
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const role = (session.user as any)?.role;
  if (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN') {
    throw new Error('Permission denied.');
  }

  const { title, message, target = 'ALL' } = input;

  if (!title.trim()) {
    throw new Error('Notification title is required.');
  }

  if (!message.trim()) {
    throw new Error('Notification message is required.');
  }

  // Filter tokens based on user role if target is specified
  let userWhereClause: any = {};
  if (target === 'CAPTAINS') {
    userWhereClause = { role: 'CAPTAIN' };
  } else if (target === 'PLAYERS') {
    userWhereClause = { role: 'PLAYER' };
  }

  const tokens = await prisma.userPushToken.findMany({
    where: {
      user: userWhereClause,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });

  if (!tokens.length) {
    return {
      success: true,
      sent: 0,
      failed: 0,
      invalidTokensRemoved: 0,
      totalTokens: 0,
      message: 'No registered push tokens found for the selected audience.',
    };
  }

  const notifications: PushNotificationPayload[] = tokens.map((pt) => {
    const playerName = pt.user?.name?.trim() || pt.user?.username || 'Player';
    // Replace {name} placeholder if present in custom message
    const personalizedBody = message.replace(/\{name\}/gi, playerName);

    return {
      toToken: pt.token,
      title: title.trim(),
      body: personalizedBody,
      data: {
        type: 'CUSTOM_ORGANIZER_ANNOUNCEMENT',
        sentAt: new Date().toISOString(),
      },
    };
  });

  const result = await sendPushNotifications(notifications);

  return {
    success: true,
    sent: result.sent,
    failed: result.failed,
    invalidTokensRemoved: result.invalidTokensRemoved,
    totalTokens: tokens.length,
    message: `Push notification dispatched! Sent: ${result.sent}, Failed/Invalid: ${result.failed}`,
  };
}

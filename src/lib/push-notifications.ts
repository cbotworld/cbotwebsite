import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '@/lib/prisma';

const expo = new Expo();

export interface PushNotificationPayload {
  toToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null | string;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

/**
 * Send batch push notifications via Expo Push Notification Service.
 * Automatically cleans up unregistered push tokens from the database.
 */
export async function sendPushNotifications(
  notifications: PushNotificationPayload[],
): Promise<{ sent: number; failed: number; invalidTokensRemoved: number }> {
  if (!notifications.length) {
    return { sent: 0, failed: 0, invalidTokensRemoved: 0 };
  }

  const messages: ExpoPushMessage[] = [];
  const validTokenMap = new Map<string, PushNotificationPayload>();

  for (const n of notifications) {
    if (!n.toToken || !Expo.isExpoPushToken(n.toToken)) {
      console.warn(`[Push] Skipping invalid Expo push token: ${n.toToken}`);
      continue;
    }
    validTokenMap.set(n.toToken, n);
    messages.push({
      to: n.toToken,
      sound: n.sound !== undefined ? (n.sound as any) : 'default',
      title: n.title,
      body: n.body,
      data: n.data || {},
      badge: n.badge,
      channelId: n.channelId || 'cbot-default',
      priority: n.priority || 'high',
    });
  }

  if (!messages.length) {
    return { sent: 0, failed: 0, invalidTokensRemoved: 0 };
  }

  const chunks = expo.chunkPushNotifications(messages);
  let sentCount = 0;
  let failCount = 0;
  const invalidTokens: string[] = [];

  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'ok') {
          sentCount++;
        } else {
          failCount++;
          console.error('[Push] Ticket error:', ticket.message, ticket.details);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            const token = (chunk[i].to as string) || '';
            if (token) invalidTokens.push(token);
          }
        }
      }
    } catch (error) {
      console.error('[Push] Error sending push chunk:', error);
      failCount += chunk.length;
    }
  }

  // Remove invalid/unregistered tokens from database
  let invalidTokensRemoved = 0;
  if (invalidTokens.length) {
    try {
      const res = await prisma.userPushToken.deleteMany({
        where: { token: { in: invalidTokens } },
      });
      invalidTokensRemoved = res.count;
      console.log(`[Push] Removed ${res.count} invalid push token(s) from database.`);
    } catch (delErr) {
      console.error('[Push] Failed to delete invalid tokens:', delErr);
    }
  }

  return { sent: sentCount, failed: failCount, invalidTokensRemoved };
}

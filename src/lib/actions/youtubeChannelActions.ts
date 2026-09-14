'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unstable_noStore as noStore } from 'next/cache';
import { getYouTubeChannelPool, getAccessTokenForChannel } from '@/lib/youtube-live';

async function verifyAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }
  const role = (session.user as any).role;
  if (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN') {
    throw new Error('Forbidden: Admin access required');
  }
  return session;
}

export async function getYouTubeChannelsStatusAction() {
  noStore();
  try {
    await verifyAdminAuth();

    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'youtube_refresh_token',
            'youtube_channel_1_title',
            'youtube_channel_1_id',
            'youtube_refresh_token_2',
            'youtube_channel_2_title',
            'youtube_channel_2_id',
            'youtube_active_channel_mode',
          ],
        },
      },
    });
    const map = new Map(settings.map((s) => [s.key, s.value]));

    const ch1DbToken = map.get('youtube_refresh_token');
    const ch1EnvToken = process.env.YOUTUBE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
    const ch1Token = ch1DbToken || ch1EnvToken;
    const ch1Connected = !!ch1Token;
    const ch1Title = map.get('youtube_channel_1_title') || (ch1Connected ? 'Channel 1 (Primary)' : 'Not Connected');
    const ch1Id = map.get('youtube_channel_1_id') || '';

    const ch2DbToken = map.get('youtube_refresh_token_2');
    const ch2EnvToken = process.env.YOUTUBE_REFRESH_TOKEN_2 || process.env.GOOGLE_REFRESH_TOKEN_2;
    const ch2Token = ch2DbToken || ch2EnvToken;
    const ch2Connected = !!ch2Token;
    const ch2Title = map.get('youtube_channel_2_title') || (ch2Connected ? 'Channel 2 (Backup)' : 'Not Connected');
    const ch2Id = map.get('youtube_channel_2_id') || '';

    const mode = (map.get('youtube_active_channel_mode') as any) || 'AUTO_FAILOVER';

    return {
      success: true,
      mode,
      channel1: {
        connected: ch1Connected,
        title: ch1Title,
        channelId: ch1Id,
        source: ch1DbToken ? 'DATABASE' : ch1EnvToken ? 'ENV' : 'NONE',
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      },
      channel2: {
        connected: ch2Connected,
        title: ch2Title,
        channelId: ch2Id,
        source: ch2DbToken ? 'DATABASE' : ch2EnvToken ? 'ENV' : 'NONE',
        hasClientId: !!(process.env.GOOGLE_CLIENT_ID_2 || process.env.GOOGLE_CLIENT_ID),
        hasClientSecret: !!(process.env.GOOGLE_CLIENT_SECRET_2 || process.env.GOOGLE_CLIENT_SECRET),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to fetch YouTube channel statuses',
      mode: 'AUTO_FAILOVER',
      channel1: { connected: false, title: '', channelId: '', source: 'NONE', hasClientId: false, hasClientSecret: false },
      channel2: { connected: false, title: '', channelId: '', source: 'NONE', hasClientId: false, hasClientSecret: false },
    };
  }
}

export async function testYouTubeChannelConnectionAction(channelIndex: 1 | 2) {
  noStore();
  try {
    await verifyAdminAuth();

    const pool = await getYouTubeChannelPool();
    const config = pool.find((c) => c.channelIndex === channelIndex);

    if (!config || !config.refreshToken) {
      return {
        success: false,
        error: `Channel ${channelIndex} is not connected. Please click 'Connect Google OAuth' first.`,
      };
    }

    const accessToken = await getAccessTokenForChannel(config);

    const profileRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const data = await profileRes.json();
    if (data.error) {
      return {
        success: false,
        error: data.error?.message || `YouTube API Error ${data.error?.code}`,
      };
    }

    const item = data.items?.[0];
    if (!item) {
      return {
        success: false,
        error: 'No YouTube channel found for the authenticated Google account.',
      };
    }

    const channelTitle = item.snippet?.title || `Channel ${channelIndex}`;
    const channelId = item.id || '';
    const subscriberCount = item.statistics?.subscriberCount || '0';
    const videoCount = item.statistics?.videoCount || '0';

    // Update title and ID in database
    const titleKey = channelIndex === 2 ? 'youtube_channel_2_title' : 'youtube_channel_1_title';
    const idKey = channelIndex === 2 ? 'youtube_channel_2_id' : 'youtube_channel_1_id';

    if (channelTitle) {
      await prisma.systemSetting.upsert({
        where: { key: titleKey },
        update: { value: channelTitle },
        create: { key: titleKey, value: channelTitle },
      });
    }

    if (channelId) {
      await prisma.systemSetting.upsert({
        where: { key: idKey },
        update: { value: channelId },
        create: { key: idKey, value: channelId },
      });
    }

    return {
      success: true,
      channelTitle,
      channelId,
      subscriberCount,
      videoCount,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to test connection',
    };
  }
}

export async function setYouTubeActiveModeAction(mode: 'AUTO_FAILOVER' | 'CHANNEL_1_ONLY' | 'CHANNEL_2_ONLY') {
  noStore();
  try {
    await verifyAdminAuth();
    await prisma.systemSetting.upsert({
      where: { key: 'youtube_active_channel_mode' },
      update: { value: mode },
      create: { key: 'youtube_active_channel_mode', value: mode },
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to set active mode' };
  }
}

export async function disconnectYouTubeChannelAction(channelIndex: 1 | 2) {
  noStore();
  try {
    await verifyAdminAuth();
    const tokenKey = channelIndex === 2 ? 'youtube_refresh_token_2' : 'youtube_refresh_token';
    const titleKey = channelIndex === 2 ? 'youtube_channel_2_title' : 'youtube_channel_1_title';
    const idKey = channelIndex === 2 ? 'youtube_channel_2_id' : 'youtube_channel_1_id';

    await prisma.systemSetting.deleteMany({
      where: { key: { in: [tokenKey, titleKey, idKey] } },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to disconnect channel' };
  }
}

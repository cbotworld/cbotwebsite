import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { uploadRecordedVideoToYouTube } from '@/lib/actions/youtubeActions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://otvbywtuyvufxxvlizqp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dmJ5d3R1eXZ1Znh4dmxpenFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA3ODk0NywiZXhwIjoyMTAxNjU0OTQ3fQ.WUg--SXP1DAvSXJqinDzorRNkJTGciNnBoK1_80NHB0';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('video') as Blob | null;
    const matchId = formData.get('matchId') as string | null;
    const streamId = formData.get('streamId') as string | null;

    if (!file || !matchId) {
      return NextResponse.json({ success: false, error: 'Missing video or matchId' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.type?.includes('mp4') ? 'mp4' : 'webm';
    const fileName = `recordings/${matchId.toLowerCase()}_${Date.now()}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from('teams')
      .upload(fileName, buffer, {
        contentType: file.type || 'video/webm',
        cacheControl: '86400',
        upsert: true,
      });

    if (error) {
      console.error('Supabase admin video upload error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const { data: publicData } = supabaseAdmin.storage.from('teams').getPublicUrl(data.path);
    const videoUrl = publicData.publicUrl;

    // Calculate Day End Time (8:00 PM IST of the tournament day)
    let dayEndTime = new Date();
    const monMatch = matchId ? matchId.match(/monument_(\d+)/i) : null;
    if (monMatch) {
      const dayNum = parseInt(monMatch[1], 10);
      dayEndTime = new Date(Date.UTC(2026, 7, 9 + dayNum, 14, 30, 0));
    } else {
      dayEndTime.setHours(20, 0, 0, 0);
    }
    const retention72h = new Date(dayEndTime.getTime() + 72 * 60 * 60 * 1000);

    const streamUpdateData = {
      youtubeUrl: videoUrl,
      youtubeEmbedUrl: videoUrl,
      status: 'ARCHIVED' as const,
      streamEndedAt: new Date(),
      recordedAt: new Date(),
      expiresAt: retention72h,
    };

    if (streamId) {
      await prisma.liveStream.update({
        where: { id: streamId },
        data: streamUpdateData,
      }).catch((e) => console.warn('Prisma liveStream update notice:', e));
    } else {
      await prisma.liveStream.updateMany({
        where: { matchId },
        data: streamUpdateData,
      }).catch((e) => console.warn('Prisma liveStream updateMany notice:', e));
    }

    // Freeze match status as COMPLETED
    await prisma.match.update({
      where: { id: matchId },
      data: { status: 'COMPLETED' },
    }).catch(() => {});

    // Trigger Background YouTube API Upload (Permanent cloud archive)
    const targetStream = streamId 
      ? { id: streamId } 
      : await prisma.liveStream.findFirst({ where: { matchId }, orderBy: { createdAt: 'desc' } });

    if (targetStream?.id) {
      uploadRecordedVideoToYouTube({
        streamId: targetStream.id,
        videoUrl: videoUrl,
        title: `CBOT Official Match - ${matchId.toUpperCase()}`,
        description: `Official CBOT Match Recording for ${matchId}.\nRecorded live from the player studio.\nVisit https://www.cbotworld.com/`,
      }).catch((ytErr: any) => console.warn('Background YouTube upload notice:', ytErr));
    }

    return NextResponse.json({ success: true, url: videoUrl });
  } catch (err: any) {
    console.error('Upload video route exception:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

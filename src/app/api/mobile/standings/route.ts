import { NextResponse } from 'next/server';
import { getPublicStandings } from '@/lib/actions/playerScoreActions';
import { mobileCorsHeaders } from '@/lib/mobile-cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

export async function GET() {
  try {
    const payload = await getPublicStandings();
    return NextResponse.json(
      { success: true, ...payload },
      { headers: { ...mobileCorsHeaders, 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[mobile/standings]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load standings.',
        edition: null,
        blocks: [],
        players: [],
        placement: [],
        stages: [],
      },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}

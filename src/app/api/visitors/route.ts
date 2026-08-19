import { NextResponse } from 'next/server';
import { getVisitorCount, incrementVisitorCount } from '@/lib/actions/visitorActions';

const CACHE_SECONDS = 6 * 60 * 60; // 6 hours

export async function GET() {
  const count = await getVisitorCount();
  return NextResponse.json(
    { count },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`,
      },
    }
  );
}

export async function POST() {
  const count = await incrementVisitorCount();
  return NextResponse.json({ count });
}

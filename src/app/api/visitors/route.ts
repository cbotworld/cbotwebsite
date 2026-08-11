import { NextResponse } from 'next/server';
import { getVisitorCount, incrementVisitorCount } from '@/lib/actions/visitorActions';

export async function GET() {
  const count = await getVisitorCount();
  return NextResponse.json({ count }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST() {
  const count = await incrementVisitorCount();
  return NextResponse.json({ count });
}

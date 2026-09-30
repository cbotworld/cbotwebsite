import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_SUPABASE_URL = 'http://cbot-supabase-f44128-62-72-41-216.sslip.io';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    if (!path || path.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    const relativePath = path.join('/');
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const baseUrl = rawUrl.replace(/\/+$/, '');
    const targetUrl = `${baseUrl}/storage/v1/object/public/${relativePath}`;

    try {
      const res = await fetch(targetUrl, {
        cache: 'no-store',
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await res.arrayBuffer();
        return new NextResponse(arrayBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (e) {
      // Ignore and attempt bucket fallback below
    }

    // Bucket swap fallback: if requested in 'images' check 'teams' and vice versa
    if (path[0] === 'images' || path[0] === 'teams') {
      const altBucket = path[0] === 'images' ? 'teams' : 'images';
      const altPath = [altBucket, ...path.slice(1)].join('/');
      const altUrl = `${baseUrl}/storage/v1/object/public/${altPath}`;
      try {
        const altRes = await fetch(altUrl, { cache: 'no-store' });
        if (altRes.ok) {
          const contentType = altRes.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await altRes.arrayBuffer();
          return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      } catch (e) {
        // Fallback failed
      }
    }

    return new NextResponse('Asset not found', { status: 404 });
  } catch (error: any) {
    return new NextResponse(`Server error: ${error.message}`, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { compareAppVersions, getPlayStoreAndroidVersion } from '@/lib/play-store-version';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const current = (request.nextUrl.searchParams.get('current') || '').trim();
    const play = await getPlayStoreAndroidVersion();
    const updateAvailable = Boolean(
      play.latestVersion && current && compareAppVersions(play.latestVersion, current) > 0,
    );

    return NextResponse.json(
      {
        success: true,
        platform: 'android',
        packageName: play.packageName,
        storeUrl: play.storeUrl,
        latestVersion: play.latestVersion,
        currentVersion: current || null,
        updateAvailable,
      },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not check Google Play version.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { compareAppVersions, getPlayStoreAndroidVersion } from '@/lib/play-store-version';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

async function getSettingValue(key: string): Promise<string | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    return setting?.value?.trim() || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentVersion = (request.nextUrl.searchParams.get('current') || '').trim();
    const currentBuild = (request.nextUrl.searchParams.get('build') || '').trim();
    const platform = (request.nextUrl.searchParams.get('platform') || 'android').toLowerCase().trim();

    const isIos = platform === 'ios';

    // Environment variables → Database SystemSetting → Hardcoded Fallback
    const envVersion = isIos
      ? process.env.LATEST_IOS_VERSION
      : process.env.LATEST_ANDROID_VERSION;
    const envBuild = isIos
      ? process.env.LATEST_IOS_BUILD
      : process.env.LATEST_ANDROID_BUILD;

    const dbVersion = await getSettingValue(isIos ? 'cbot_latest_ios_version' : 'cbot_latest_android_version');
    const dbBuild = await getSettingValue(isIos ? 'cbot_latest_ios_build' : 'cbot_latest_android_build');

    let storeUrl = isIos
      ? (process.env.IOS_STORE_URL || 'https://apps.apple.com/app/id6742533036')
      : (process.env.ANDROID_STORE_URL || 'https://play.google.com/store/apps/details?id=com.cbotworld');

    let targetVersion = envVersion || dbVersion || '1.3';
    let targetBuild = envBuild || dbBuild || '30';

    // Android extra fallback: Try Play Store scraping if env/db not higher
    if (!isIos) {
      try {
        const play = await getPlayStoreAndroidVersion();
        if (play.storeUrl) storeUrl = play.storeUrl;
        if (play.latestVersion && compareAppVersions(play.latestVersion, targetVersion) > 0) {
          targetVersion = play.latestVersion;
        }
      } catch {
        // Optional fallback.
      }
    }

    // Version comparison:
    // 1. If user has a newer semver (e.g. 1.3.7 > 1.3.5), updateAvailable is FALSE.
    // 2. If store has a newer semver (e.g. 1.3.5 > 1.3.4), updateAvailable is TRUE.
    // 3. If semver is identical (e.g. 1.3.5 == 1.3.5), compare build numbers.
    const numericTargetBuild = parseInt(targetBuild, 10);
    const numericCurrentBuild = parseInt(currentBuild, 10);

    let updateAvailable = false;
    if (currentVersion && targetVersion) {
      const versionDiff = compareAppVersions(targetVersion, currentVersion);
      if (versionDiff > 0) {
        // Store version is higher
        updateAvailable = true;
      } else if (versionDiff === 0) {
        // Same version - check build number
        if (!isNaN(numericTargetBuild) && !isNaN(numericCurrentBuild) && numericCurrentBuild > 0) {
          updateAvailable = numericTargetBuild > numericCurrentBuild;
        }
      } else {
        // User version is higher (e.g. 1.3.7 vs 1.3.5) - definitely NO update needed
        updateAvailable = false;
      }
    } else if (!isNaN(numericTargetBuild) && !isNaN(numericCurrentBuild) && numericCurrentBuild > 0) {
      updateAvailable = numericTargetBuild > numericCurrentBuild;
    }

    return NextResponse.json(
      {
        success: true,
        platform: isIos ? 'ios' : 'android',
        storeUrl,
        latestVersion: targetVersion,
        latestBuild: targetBuild,
        currentVersion: currentVersion || null,
        currentBuild: currentBuild || null,
        updateAvailable,
      },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not check app version.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}

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

    // iOS update popups are completely disabled as requested
    if (isIos) {
      return NextResponse.json(
        {
          success: true,
          platform: 'ios',
          storeUrl: 'https://apps.apple.com/app/id6742533036',
          latestVersion: null,
          latestBuild: null,
          currentVersion: currentVersion || null,
          currentBuild: currentBuild || null,
          updateAvailable: false,
        },
        { headers: mobileCorsHeaders },
      );
    }

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

    let targetVersion = envVersion || dbVersion || '';
    let targetBuild = envBuild || dbBuild || '';

    // Android fallback: Only try Play Store scraping if neither env nor db version was configured
    if (!isIos && !targetVersion) {
      try {
        const play = await getPlayStoreAndroidVersion();
        if (play.storeUrl) storeUrl = play.storeUrl;
        if (play.latestVersion) {
          targetVersion = play.latestVersion;
        }
      } catch {
        // Optional fallback.
      }
    }

    if (!targetVersion) targetVersion = isIos ? '1.4.6' : '1.4.6';
    if (!targetBuild) targetBuild = isIos ? '48' : '48';

    const numericTargetBuild = parseInt(targetBuild, 10);
    const numericCurrentBuild = parseInt(currentBuild, 10);
    const forceUpdateEnabled =
      process.env.ENABLE_UPDATE_POPUP === 'true' ||
      process.env.NEXT_PUBLIC_ENABLE_UPDATE_POPUP === 'true' ||
      (await getSettingValue('cbot_enable_update_popup')) === 'true';
    let updateAvailable = false;
    if (forceUpdateEnabled) {
      if (currentVersion && targetVersion) {
        const versionDiff = compareAppVersions(targetVersion, currentVersion);
        if (versionDiff > 0) {
          updateAvailable = true;
        } else if (versionDiff === 0) {
          if (!isNaN(numericTargetBuild) && !isNaN(numericCurrentBuild) && numericCurrentBuild > 0) {
            updateAvailable = numericTargetBuild > numericCurrentBuild;
          }
        }
      } else if (!isNaN(numericTargetBuild) && !isNaN(numericCurrentBuild) && numericCurrentBuild > 0) {
        updateAvailable = numericTargetBuild > numericCurrentBuild;
      }
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

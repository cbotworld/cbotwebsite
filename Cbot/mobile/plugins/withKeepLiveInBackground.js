const { withAndroidManifest, withDangerousMod } =
  require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KEEP_MARKER = 'CBOT_KEEP_LIVE_IN_BACKGROUND';

function patchFile(file, search, replace) {
  if (!fs.existsSync(file)) {
    console.warn(`[withKeepLiveInBackground] missing ${file}`);
    return;
  }
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes(KEEP_MARKER)) return;
  if (!src.includes(search)) {
    console.warn(`[withKeepLiveInBackground] pattern not found in ${file}`);
    return;
  }
  fs.writeFileSync(file, src.replace(search, replace));
}

function patchLiveStreamLibrary(projectRoot) {
  patchFile(
    path.join(
      projectRoot,
      'node_modules/expo-live-stream/android/src/main/java/expo/modules/livestream/PublisherView.kt',
    ),
    `  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
    super.onWindowFocusChanged(hasWindowFocus)
    if (!hasWindowFocus) {
      Log.d(TAG, "Window lost focus (background)")
      wasStreamingBeforeBackground = isStreaming
      isBackgrounding = true // Suppress RTMP onDisconnect callback
      try {
        val camera = rtmpCamera ?: return
        if (isStreaming) { camera.stopStream(); isStreaming = false }
        camera.stopPreview()
        isCameraInitialized = false
      } catch (e: Exception) { Log.w(TAG, "Error on background", e) }`,
    `  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
    super.onWindowFocusChanged(hasWindowFocus)
    // ${KEEP_MARKER}
    if (!hasWindowFocus) {
      Log.d(TAG, "Window lost focus — keeping live stream")
      isBackgrounding = true
      return
      try {
        val camera = rtmpCamera ?: return
        if (isStreaming) { camera.stopStream(); isStreaming = false }
        camera.stopPreview()
        isCameraInitialized = false
      } catch (e: Exception) { Log.w(TAG, "Error on background", e) }`,
  );

  const iosFile = path.join(projectRoot, 'node_modules/expo-live-stream/ios/PublisherView.swift');
  patchFile(
    iosFile,
    `  @objc private func appWillResignActive() {
    print("[ExpoLiveStream] App going to background")
    wasStreamingBeforeBackground = isStreaming
    if isStreaming {
      isStreaming = false
      stopBitrateTimer()
      Task {
        _ = try? await stream?.close()
        _ = try? await connection?.close()
      }
    }
    // Detach camera (iOS requires this in background)
    if let mixer = mixer {
      Task {
        try? await mixer.attachVideo(nil)
      }
    }
  }`,
    `  @objc private func appWillResignActive() {
    // ${KEEP_MARKER}
    print("[ExpoLiveStream] App going to background — keeping live stream")
  }`,
  );
}

function addUsesPermission(androidManifest, name) {
  const manifest = androidManifest.manifest;
  if (!manifest['uses-permission']) manifest['uses-permission'] = [];
  const already = manifest['uses-permission'].some((item) => item.$?.['android:name'] === name);
  if (!already) {
    manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function withKeepLiveInBackground(config) {
  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      patchLiveStreamLibrary(mod.modRequest.projectRoot);
      return mod;
    },
  ]);

  config = withDangerousMod(config, [
    'ios',
    async (mod) => {
      patchLiveStreamLibrary(mod.modRequest.projectRoot);
      return mod;
    },
  ]);

  config = withAndroidManifest(config, (mod) => {
    addUsesPermission(mod.modResults, 'android.permission.FOREGROUND_SERVICE');
    addUsesPermission(mod.modResults, 'android.permission.FOREGROUND_SERVICE_CAMERA');
    addUsesPermission(mod.modResults, 'android.permission.FOREGROUND_SERVICE_MICROPHONE');
    addUsesPermission(mod.modResults, 'android.permission.POST_NOTIFICATIONS');
    addUsesPermission(mod.modResults, 'android.permission.WAKE_LOCK');

    const app = mod.modResults.manifest.application?.[0];
    const activities = app?.activity || [];
    const main = activities.find(
      (item) => item.$?.['android:name'] === '.MainActivity' || item.$?.['android:name']?.endsWith('MainActivity'),
    );
    if (main?.$) {
      main.$['android:supportsPictureInPicture'] = 'true';
      main.$['android:resizeableActivity'] = 'true';
      const changes = main.$['android:configChanges'] || '';
      const needed = ['keyboard', 'keyboardHidden', 'orientation', 'screenSize', 'screenLayout', 'smallestScreenSize', 'uiMode'];
      const current = new Set(changes.split('|').filter(Boolean));
      needed.forEach((item) => current.add(item));
      main.$['android:configChanges'] = [...current].join('|');
    }
    return mod;
  });

  return config;
}

module.exports = withKeepLiveInBackground;

let configPlugins;
try {
  configPlugins = require('@expo/config-plugins');
} catch {
  try {
    const easPath = require.resolve('eas-cli/node_modules/@expo/config-plugins', { paths: [process.cwd(), __dirname] });
    configPlugins = require(easPath);
  } catch {
    try {
      configPlugins = require(require('path').join(process.env.APPDATA || '', 'npm/node_modules/eas-cli/node_modules/@expo/config-plugins'));
    } catch {
      configPlugins = {
        withAndroidManifest: (config, fn) => config,
        withDangerousMod: (config, arr) => config,
      };
    }
  }
}
const { withAndroidManifest, withDangerousMod } = configPlugins;
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
  // 1. Android PublisherView.kt
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
    `  var zoomLevel: Float = 1.0f

  fun applyZoom(level: Float) {
    zoomLevel = level
    post {
      val camera = rtmpCamera ?: return@post
      try {
        camera.setZoom(level)
        Log.d(TAG, "applyZoom: level=$level")
      } catch (e: Exception) {
        Log.w(TAG, "applyZoom failed for level=$level", e)
      }
    }
  }

  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
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

  // 2. Android ExpoLiveStreamModule.kt
  patchFile(
    path.join(
      projectRoot,
      'node_modules/expo-live-stream/android/src/main/java/expo/modules/livestream/ExpoLiveStreamModule.kt',
    ),
    `    AsyncFunction("toggleMute") {
      PublisherView.activeInstance?.let { view -> view.post { view.toggleMute() } }
    }

    // ======== Publisher View ========
    View(PublisherView::class) {
      Events(
        "onConnectionSuccess",
        "onConnectionFailed",
        "onDisconnect",
        "onStreamStateChanged",
        "onBitrateUpdate"
      )

      Prop("url") { view: PublisherView, url: String ->
        view.url = url
      }
      Prop("streamKey") { view: PublisherView, key: String ->
        view.streamKey = key
      }`,
    `    AsyncFunction("toggleMute") {
      PublisherView.activeInstance?.let { view -> view.post { view.toggleMute() } }
    }

    AsyncFunction("setZoom") { zoom: Double ->
      // ${KEEP_MARKER}
      PublisherView.activeInstance?.let { view -> view.post { view.applyZoom(zoom.toFloat()) } }
    }

    // ======== Publisher View ========
    View(PublisherView::class) {
      Events(
        "onConnectionSuccess",
        "onConnectionFailed",
        "onDisconnect",
        "onStreamStateChanged",
        "onBitrateUpdate"
      )

      Prop("url") { view: PublisherView, url: String ->
        view.url = url
      }
      Prop("streamKey") { view: PublisherView, key: String ->
        view.streamKey = key
      }
      Prop("zoom") { view: PublisherView, zoom: Double ->
        view.applyZoom(zoom.toFloat())
      }`,
  );

  // 3. iOS PublisherView.swift
  const iosFile = path.join(projectRoot, 'node_modules/expo-live-stream/ios/PublisherView.swift');
  patchFile(
    iosFile,
    `          await mixer.setVideoOrientation(.portrait)
          try await mixer.attachVideo(camera)`,
    `          let orientation: AVCaptureVideoOrientation = (self.videoWidth >= self.videoHeight) ? .landscapeRight : .portrait
          await mixer.setVideoOrientation(orientation)
          try await mixer.attachVideo(camera)`,
  );
  patchFile(
    iosFile,
    `    Task {
      do {
        let videoSettings = VideoCodecSettings(
          videoSize: CGSize(width: CGFloat(videoWidth), height: CGFloat(videoHeight)),
          bitRate: videoBitrate,
          maxKeyFrameIntervalDuration: 1,
          allowFrameReordering: false
        )`,
    `    Task {
      do {
        if let mixer = self.mixer {
          let orientation: AVCaptureVideoOrientation = (self.videoWidth >= self.videoHeight) ? .landscapeRight : .portrait
          await mixer.setVideoOrientation(orientation)
          if let stream = self.stream {
            await mixer.addOutput(stream)
          }
        }

        let videoSettings = VideoCodecSettings(
          videoSize: CGSize(width: CGFloat(videoWidth), height: CGFloat(videoHeight)),
          bitRate: videoBitrate,
          maxKeyFrameIntervalDuration: 2.0,
          scalingMode: .trim,
          allowFrameReordering: false
        )`,
  );
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
    `  var zoom: CGFloat = 1.0

  func applyZoom(_ level: CGFloat) {
    zoom = level
    let position: AVCaptureDevice.Position = isFrontCamera ? .front : .back

    if level < 1.0 {
      if let ultraWide = AVCaptureDevice.default(.builtInUltraWideCamera, for: .video, position: position) {
        if let mixer = mixer {
          Task {
            try? await mixer.attachVideo(ultraWide)
          }
        }
        return
      }
    }

    if let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) {
      if let mixer = mixer {
        Task {
          try? await mixer.attachVideo(camera)
          do {
            try camera.lockForConfiguration()
            let clamped = min(max(level, camera.minAvailableVideoZoomFactor), camera.maxAvailableVideoZoomFactor)
            camera.videoZoomFactor = clamped
            camera.unlockForConfiguration()
          } catch {
            print("[ExpoLiveStream] Zoom error: \\(error)")
          }
        }
      }
    }
  }

  @objc private func appWillResignActive() {
    // ${KEEP_MARKER}
    print("[ExpoLiveStream] App going to background — keeping live stream")
  }`,
  );

  // 4. iOS ExpoLiveStreamModule.swift
  const iosModuleFile = path.join(projectRoot, 'node_modules/expo-live-stream/ios/ExpoLiveStreamModule.swift');
  patchFile(
    iosModuleFile,
    `    AsyncFunction("toggleMute") {
      await MainActor.run {
        PublisherView.activeInstance?.toggleMute()
      }
    }

    // ======== Publisher View ========
    View(PublisherView.self) {
      Events(
        "onConnectionSuccess",
        "onConnectionFailed",
        "onDisconnect",
        "onStreamStateChanged",
        "onBitrateUpdate"
      )

      Prop("url") { (view: PublisherView, url: String) in
        view.url = url
      }
      Prop("streamKey") { (view: PublisherView, key: String) in
        view.streamKey = key
      }`,
    `    AsyncFunction("toggleMute") {
      await MainActor.run {
        PublisherView.activeInstance?.toggleMute()
      }
    }

    AsyncFunction("setZoom") { (zoom: Double) in
      // ${KEEP_MARKER}
      await MainActor.run {
        PublisherView.activeInstance?.applyZoom(CGFloat(zoom))
      }
    }

    // ======== Publisher View ========
    View(PublisherView.self) {
      Events(
        "onConnectionSuccess",
        "onConnectionFailed",
        "onDisconnect",
        "onStreamStateChanged",
        "onBitrateUpdate"
      )

      Prop("url") { (view: PublisherView, url: String) in
        view.url = url
      }
      Prop("streamKey") { (view: PublisherView, key: String) in
        view.streamKey = key
      }
      Prop("zoom") { (view: PublisherView, zoom: Double) in
        view.applyZoom(CGFloat(zoom))
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

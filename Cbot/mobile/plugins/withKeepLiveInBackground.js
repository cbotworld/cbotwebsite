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
  const androidPublisherFile = path.join(
    projectRoot,
    'node_modules/expo-live-stream/android/src/main/java/expo/modules/livestream/PublisherView.kt',
  );

  patchFile(
    androidPublisherFile,
    `import android.content.pm.PackageManager
import android.util.Log`,
    `import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import android.util.Log`,
  );

  patchFile(
    androidPublisherFile,
    `  init {
    activeInstance = this
    Log.d(TAG, "View created, activeInstance set")
    setupView()
  }`,
    `  init {
    activeInstance = this
    Log.d(TAG, "View created, activeInstance set")
    discoverCameras()
    setupView()
  }`,
  );

  patchFile(
    androidPublisherFile,
    `        camera.switchCamera()
        isFrontCamera = !isFrontCamera

        if (zoomLevel != 1.0f) {`,
    `        camera.switchCamera()
        isFrontCamera = !isFrontCamera
        currentCameraId = if (isFrontCamera) frontCameraId else mainBackCameraId

        if (zoomLevel != 1.0f) {`,
  );

  patchFile(
    androidPublisherFile,
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

  // Physical Camera IDs (Ultra-Wide vs Main Wide)
  private var mainBackCameraId: String? = null
  private var ultraWideCameraId: String? = null
  private var frontCameraId: String? = null
  private var currentCameraId: String? = null

  private fun discoverCameras() {
    try {
      val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager ?: return
      data class CamInfo(val id: String, val focalLength: Float, val fov: Double, val facing: Int)

      val backCameras = mutableListOf<CamInfo>()
      val frontCameras = mutableListOf<CamInfo>()

      fun inspectCamera(id: String) {
        if (backCameras.any { it.id == id } || frontCameras.any { it.id == id }) return
        try {
          val chars = cameraManager.getCameraCharacteristics(id)
          val facing = chars.get(CameraCharacteristics.LENS_FACING) ?: return
          val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
          val sensorSize = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
          val fLength = focalLengths?.firstOrNull() ?: 4.0f
          val fov = if (sensorSize != null && fLength > 0) {
            2.0 * Math.atan((sensorSize.width / (2.0 * fLength)).toDouble()) * (180.0 / Math.PI)
          } else {
            (1.0 / fLength).toDouble()
          }

          if (facing == CameraCharacteristics.LENS_FACING_BACK) {
            backCameras.add(CamInfo(id, fLength, fov, facing))
          } else if (facing == CameraCharacteristics.LENS_FACING_FRONT) {
            frontCameras.add(CamInfo(id, fLength, fov, facing))
          }

          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val physicalIds = chars.physicalCameraIds
            for (pId in physicalIds) {
              if (backCameras.none { it.id == pId } && frontCameras.none { it.id == pId }) {
                try {
                  val pChars = cameraManager.getCameraCharacteristics(pId)
                  val pFacing = pChars.get(CameraCharacteristics.LENS_FACING) ?: facing
                  val pFocal = pChars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)?.firstOrNull() ?: fLength
                  val pSensor = pChars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE) ?: sensorSize
                  val pFov = if (pSensor != null && pFocal > 0) {
                    2.0 * Math.atan((pSensor.width / (2.0 * pFocal)).toDouble()) * (180.0 / Math.PI)
                  } else {
                    (1.0 / pFocal).toDouble()
                  }
                  if (pFacing == CameraCharacteristics.LENS_FACING_BACK) {
                    backCameras.add(CamInfo(pId, pFocal, pFov, pFacing))
                  }
                } catch (_: Exception) {}
              }
            }
          }
        } catch (e: Exception) {
          Log.w(TAG, "Error inspecting camera $id", e)
        }
      }

      for (id in cameraManager.cameraIdList) {
        inspectCamera(id)
      }

      if (frontCameras.isNotEmpty()) {
        frontCameraId = frontCameras.first().id
      }

      backCameras.sortByDescending { it.fov }

      if (backCameras.size >= 2) {
        ultraWideCameraId = backCameras.first().id
        mainBackCameraId = backCameras.find { it.id == "0" }?.id ?: backCameras[1].id
        if (mainBackCameraId == ultraWideCameraId && backCameras.size > 1) {
          mainBackCameraId = backCameras[1].id
        }
      } else if (backCameras.isNotEmpty()) {
        mainBackCameraId = backCameras.first().id
      }

      Log.d(TAG, "discoverCameras: mainBack=$mainBackCameraId, ultraWide=$ultraWideCameraId, front=$frontCameraId")
    } catch (e: Exception) {
      Log.w(TAG, "discoverCameras failed", e)
    }
  }

  fun applyZoom(level: Float) {
    zoomLevel = level
    post {
      val camera = rtmpCamera ?: return@post
      try {
        if (!isFrontCamera) {
          if (level < 0.95f) {
            val uwId = ultraWideCameraId
            if (uwId != null && currentCameraId != uwId) {
              Log.d(TAG, "applyZoom: Switching to ultra-wide camera $uwId (level=$level)")
              currentCameraId = uwId
              try {
                camera.switchCamera(uwId)
                if (isStreaming) {
                  postDelayed({ try { camera.requestKeyFrame() } catch (_: Exception) {} }, 300)
                }
              } catch (e: Exception) {
                Log.w(TAG, "switchCamera($uwId) failed", e)
              }
              return@post
            }
          } else {
            val mainId = mainBackCameraId ?: "0"
            if (currentCameraId != null && currentCameraId != mainId && currentCameraId == ultraWideCameraId) {
              Log.d(TAG, "applyZoom: Switching back to main camera $mainId (level=$level)")
              currentCameraId = mainId
              try {
                camera.switchCamera(mainId)
                if (isStreaming) {
                  postDelayed({ try { camera.requestKeyFrame() } catch (_: Exception) {} }, 300)
                }
              } catch (e: Exception) {
                Log.w(TAG, "switchCamera($mainId) failed", e)
              }
              postDelayed({
                try {
                  val range = camera.zoomRange
                  val minZoom = range?.lower ?: 1.0f
                  val maxZoom = range?.upper ?: 10.0f
                  camera.setZoom(level.coerceIn(minZoom, maxZoom))
                } catch (_: Exception) {}
              }, 250)
              return@post
            }
          }
        }

        val range = camera.zoomRange
        val minZoom = range?.lower ?: 1.0f
        val maxZoom = range?.upper ?: 10.0f
        val target = level.coerceIn(minZoom, maxZoom)
        camera.setZoom(target)
        Log.d(TAG, "applyZoom: requested=$level, applied=$target (range=[$minZoom, $maxZoom])")
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
          scalingMode: .trim,
          maxKeyFrameIntervalDuration: 2,
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

  private func findCamera(type: AVCaptureDevice.DeviceType, position: AVCaptureDevice.Position) -> AVCaptureDevice? {
    let session = AVCaptureDevice.DiscoverySession(
      deviceTypes: [type],
      mediaType: .video,
      position: position
    )
    return session.devices.first
  }

  func applyZoom(_ level: CGFloat) {
    zoom = level
    let position: AVCaptureDevice.Position = isFrontCamera ? .front : .back

    Task {
      if level < 1.0 && position == .back {
        if let ultraWide = findCamera(type: .builtInUltraWideCamera, position: position) {
          if let mixer = self.mixer {
            let orientation: AVCaptureVideoOrientation = (self.videoWidth >= self.videoHeight) ? .landscapeRight : .portrait
            await mixer.setVideoOrientation(orientation)
            try? await mixer.attachVideo(ultraWide)
            await mixer.setFrameRate(self.videoFps)
            do {
              try ultraWide.lockForConfiguration()
              let ultraZoom = max(1.0, level / 0.5)
              let clamped = min(max(ultraZoom, ultraWide.minAvailableVideoZoomFactor), ultraWide.maxAvailableVideoZoomFactor)
              ultraWide.videoZoomFactor = clamped
              ultraWide.unlockForConfiguration()
            } catch {
              print("[ExpoLiveStream] UltraWide zoom error: \\(error)")
            }
          }
          return
        }
      }

      if let wideCamera = findCamera(type: .builtInWideAngleCamera, position: position) {
        if let mixer = self.mixer {
          let orientation: AVCaptureVideoOrientation = (self.videoWidth >= self.videoHeight) ? .landscapeRight : .portrait
          await mixer.setVideoOrientation(orientation)
          try? await mixer.attachVideo(wideCamera)
          await mixer.setFrameRate(self.videoFps)
          do {
            try wideCamera.lockForConfiguration()
            let clamped = min(max(level, wideCamera.minAvailableVideoZoomFactor), wideCamera.maxAvailableVideoZoomFactor)
            wideCamera.videoZoomFactor = clamped
            wideCamera.unlockForConfiguration()
          } catch {
            print("[ExpoLiveStream] Wide zoom error: \\(error)")
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

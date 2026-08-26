package expo.modules.livekeepalive

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Rational
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LiveKeepAliveModule : Module() {
  companion object {
    @Volatile
    var streaming: Boolean = false

    @JvmStatic
    fun enterPipIfStreaming(activity: Activity) {
      if (!streaming) return
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      if (!activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return
      if (activity.isInPictureInPictureMode) return
      try {
        val params = PictureInPictureParams.Builder()
          .setAspectRatio(Rational(9, 16))
          .build()
        activity.enterPictureInPictureMode(params)
      } catch (error: Throwable) {
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("LiveKeepAlive")

    OnUserLeavesActivity {
      val activity = appContext.currentActivity ?: return@OnUserLeavesActivity
      enterPipIfStreaming(activity)
    }

    AsyncFunction("start") { title: String, body: String, endUrl: String, authorization: String, apiKey: String ->
      val activity = appContext.currentActivity ?: return@AsyncFunction null
      streaming = true
      enableAutoPip(activity)

      val intent = Intent(activity, LiveKeepAliveService::class.java).apply {
        action = LiveKeepAliveService.ACTION_START
        putExtra(LiveKeepAliveService.EXTRA_TITLE, title)
        putExtra(LiveKeepAliveService.EXTRA_BODY, body)
        putExtra(LiveKeepAliveService.EXTRA_END_URL, endUrl)
        putExtra(LiveKeepAliveService.EXTRA_AUTHORIZATION, authorization)
        putExtra(LiveKeepAliveService.EXTRA_API_KEY, apiKey)
      }
      try {
        ContextCompat.startForegroundService(activity, intent)
      } catch (error: Throwable) {
        streaming = true
      }
      null
    }

    AsyncFunction("stop") {
      streaming = false
      val activity = appContext.currentActivity
      if (activity != null) {
        disableAutoPip(activity)
      }
      val context = activity ?: appContext.reactContext ?: return@AsyncFunction null
      try {
        context.startService(
          Intent(context, LiveKeepAliveService::class.java).apply {
            action = LiveKeepAliveService.ACTION_STOP
          },
        )
      } catch (error: Throwable) {
      }
      null
    }
  }

  private fun enableAutoPip(activity: Activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    try {
      activity.setPictureInPictureParams(
        PictureInPictureParams.Builder()
          .setAspectRatio(Rational(9, 16))
          .setAutoEnterEnabled(true)
          .build(),
      )
    } catch (error: Throwable) {
    }
  }

  private fun disableAutoPip(activity: Activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    try {
      activity.setPictureInPictureParams(
        PictureInPictureParams.Builder()
          .setAutoEnterEnabled(false)
          .build(),
      )
    } catch (error: Throwable) {
    }
  }
}

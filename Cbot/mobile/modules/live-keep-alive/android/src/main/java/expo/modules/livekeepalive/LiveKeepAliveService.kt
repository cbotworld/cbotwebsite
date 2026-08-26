package expo.modules.livekeepalive

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class LiveKeepAliveService : Service() {
  companion object {
    const val CHANNEL_ID = "cbot_live"
    const val NOTIF_ID = 2001
    const val ACTION_START = "expo.modules.livekeepalive.START"
    const val ACTION_STOP = "expo.modules.livekeepalive.STOP"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val EXTRA_END_URL = "endUrl"
    const val EXTRA_AUTHORIZATION = "authorization"
    const val EXTRA_API_KEY = "apiKey"
  }

  private var endUrl: String? = null
  private var authorization: String? = null
  private var apiKey: String? = null
  private var shouldEndOnDestroy = true
  private var ended = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      shouldEndOnDestroy = false
      LiveKeepAliveModule.streaming = false
      stopForegroundInternal()
      stopSelf()
      return START_NOT_STICKY
    }

    endUrl = intent?.getStringExtra(EXTRA_END_URL)
    authorization = intent?.getStringExtra(EXTRA_AUTHORIZATION)
    apiKey = intent?.getStringExtra(EXTRA_API_KEY)
    shouldEndOnDestroy = true
    ended = false
    try {
      startAsForeground(
        intent?.getStringExtra(EXTRA_TITLE) ?: "CBOT Live",
        intent?.getStringExtra(EXTRA_BODY) ?: "Streaming to YouTube",
      )
    } catch (error: Exception) {
      Log.w("LiveKeepAlive", "Could not start foreground notification", error)
    }
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    endBroadcastSilently()
    stopForegroundInternal()
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    if (shouldEndOnDestroy) {
      endBroadcastSilently()
    }
    super.onDestroy()
  }

  private fun startAsForeground(title: String, body: String) {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = if (launch != null) {
      PendingIntent.getActivity(
        this,
        0,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    } else {
      null
    }

    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body)
      .setSmallIcon(android.R.drawable.ic_media_play)
      .setOngoing(true)
      .setContentIntent(pending)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIF_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
      )
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  private fun stopForegroundInternal() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "CBOT Live", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Keeps the YouTube live stream running when you switch apps"
        setShowBadge(false)
      },
    )
  }

  private fun endBroadcastSilently() {
    if (ended) return
    ended = true
    LiveKeepAliveModule.streaming = false
    val url = endUrl
    if (url.isNullOrBlank()) return
    val thread = Thread {
      try {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        authorization?.takeIf { it.isNotBlank() }?.let { conn.setRequestProperty("Authorization", it) }
        apiKey?.takeIf { it.isNotBlank() }?.let { conn.setRequestProperty("X-App-Key", it) }
        OutputStreamWriter(conn.outputStream).use { it.write("{}") }
        conn.responseCode
        conn.disconnect()
      } catch (error: Exception) {
        Log.w("LiveKeepAlive", "end broadcast failed", error)
      }
    }
    thread.start()
    try {
      thread.join(1200)
    } catch (error: InterruptedException) {
    }
  }
}

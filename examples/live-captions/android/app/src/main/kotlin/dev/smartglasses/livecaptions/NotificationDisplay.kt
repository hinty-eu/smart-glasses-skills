package dev.smartglasses.livecaptions

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock

/**
 * Rung 4: a phone notification that the glasses' companion app mirrors (Even, Rokid, Vuzix Connect, many others).
 * No SDK. Each final caption is a new notification (a new id), at most one every 2.5 s with the newest text winning,
 * on a high-importance channel that pops up but makes no sound. Only the last [KEEP] stay; older ones are cancelled,
 * so the shade stays short and a companion app that replays its backlog cannot bring back stale lines. Each one
 * carries Repeat / Skip / Hide buttons for the phone and lock screen.
 *
 * Why a new id instead of updating one: no brand documents how it treats an update to an existing notification, and
 * Android sheds updates (not new posts) above 5 per second per app. Android XR documents its bridging rules
 * (IMPORTANCE_HIGH or MAX, non-empty title, not ongoing, no RemoteViews) and shows bridged notifications as heads-up
 * notifications with only the system clear action, so these buttons stay on the phone there. BigTextStyle falls back
 * to the standard title and text on Android XR display glasses.
 *
 * Honest limits (unverified per brand): the wearer must allow this app in the companion app's notification settings,
 * and the companion app decides how long a notification stays and how much text fits.
 */
class NotificationDisplay(private val host: DisplayHost) : GlassesDisplay {
    override val id = "notification"
    override val budget = LineBudget(lines = 2, cols = 40, partials = false)

    private val app = host.activity.applicationContext
    private val manager = app.getSystemService(NotificationManager::class.java)
    private val main = Handler(Looper.getMainLooper())
    private var allowed = false
    private var nextId = FIRST_ID
    private val posted = ArrayDeque<Int>()
    private var lastPostAt = 0L
    private var waiting: List<String>? = null
    private val postWaiting = Runnable { waiting?.let { waiting = null; post(it) } }

    override fun connect() {
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Live captions", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Captions for glasses that mirror phone notifications"
                setSound(null, null)
                enableVibration(false)
            },
        )
        if (app.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            allowed = true
            host.onStatus(id, "ready, allow this app in your glasses app's notification settings")
            return
        }
        host.requestPermissions(Manifest.permission.POST_NOTIFICATIONS) { granted ->
            allowed = granted
            host.onStatus(id, if (granted) "ready, allow this app in your glasses app's notification settings" else "notifications are off")
        }
    }

    override fun show(lines: List<String>) {
        if (!allowed || lines.isEmpty()) return
        val wait = lastPostAt + MIN_GAP_MS - SystemClock.uptimeMillis()
        if (wait > 0) {
            // Glasses show one notification at a time for a few seconds: keep only the newest text for the next slot
            if (waiting == null) main.postDelayed(postWaiting, wait)
            waiting = lines
            return
        }
        post(lines)
    }

    private fun post(lines: List<String>) {
        lastPostAt = SystemClock.uptimeMillis()
        val text = lines.joinToString(" ")
        val n = Notification.Builder(app, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_captions)
            .setContentTitle("Live captions") // never empty: Android XR skips notifications without a title
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setTimeoutAfter(60_000) // stale captions leave the shade by themselves
            .addAction(action(InputAction.REPEAT, "Repeat"))
            .addAction(action(InputAction.SKIP, "Skip"))
            .addAction(action(InputAction.HIDE, "Hide"))
            .build()
        val id = nextId++
        manager.notify(id, n)
        posted.addLast(id)
        while (posted.size > KEEP) manager.cancel(posted.removeFirst())
    }

    private fun action(a: InputAction, label: String): Notification.Action {
        val intent = Intent(app, NotificationActionReceiver::class.java).putExtra(EXTRA_ACTION, a.name)
        val pi = PendingIntent.getBroadcast(app, a.ordinal, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return Notification.Action.Builder(null, label, pi).build()
    }

    override fun clear() {
        main.removeCallbacks(postWaiting)
        waiting = null
        posted.forEach { manager.cancel(it) }
        posted.clear()
    }

    override fun disconnect() {
        clear()
        host.onStatus(id, "disconnected")
    }

    companion object {
        const val CHANNEL = "captions"
        const val EXTRA_ACTION = "action"
        private const val FIRST_ID = 1000
        private const val KEEP = 3
        private const val MIN_GAP_MS = 2_500L

        /** Set by MainActivity while it runs; a production app would route this through a foreground service. */
        var onAction: ((InputAction) -> Unit)? = null
    }
}

/** Receives the notification buttons and hands them to the running app. */
class NotificationActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.getStringExtra(NotificationDisplay.EXTRA_ACTION) ?: return
        NotificationDisplay.onAction?.invoke(InputAction.valueOf(action))
    }
}

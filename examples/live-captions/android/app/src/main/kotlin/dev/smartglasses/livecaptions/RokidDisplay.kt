package dev.smartglasses.livecaptions

import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.rokid.cxr.session.AuthResult
import com.rokid.cxr.session.CloseReason
import com.rokid.cxr.session.CxrSession
import com.rokid.cxr.session.CxrSessionManager
import com.rokid.cxr.session.GlassPermission
import com.rokid.cxr.session.ISessionLifecycleCbk
import com.rokid.cxr.session.PausedReason
import com.rokid.cxr.session.RokidAppStatus
import com.rokid.cxr.session.SessionConfig
import com.rokid.cxr.session.SessionErrorCode
import com.rokid.cxr.session.SessionState
import com.rokid.cxr.session.SessionType
import com.rokid.cxr.session.TerminatingReason
import org.json.JSONArray
import org.json.JSONObject

/**
 * Rung 1: Rokid Glasses through Rokid's phone-side SDK CXR-L (com.rokid.cxr:client-l:1.1.2).
 *
 * The Hi Rokid app owns the Bluetooth link. Order: check Hi Rokid -> requestAuthorization (a consent screen in Hi Rokid,
 * silent after the first time) -> create a CUSTOM_VIEW session with our own view JSON -> connect(token) ->
 * onSessionStarted -> customViewUpdate(...) for every change.
 * Taps on a custom view do not reach the phone, so repeat/skip/hide stay on the phone and the notification.
 * Logs use Log.i: the SDK's consumer R8 rules strip Log.d and Log.v from the whole app in minified builds.
 */
class RokidDisplay(private val host: DisplayHost) : GlassesDisplay, ActivityResultAware {
    override val id = "rokid"

    // Estimates, unverified on hardware (smart-glasses-rokid skill): 3 lines of about 22 Latin characters at 24sp in
    // the 480 px (320 dp) wide view, and at most one customViewUpdate every 250 ms so the newest partial result wins.
    override val budget = LineBudget(lines = 3, cols = 22, minIntervalMs = 250)

    private val app = host.activity.applicationContext
    private val main = Handler(Looper.getMainLooper())
    private val manager by lazy { CxrSessionManager.getInstance(app) }
    private var token: String? = null // memory only; asking again after a restart is silent
    private var session: CxrSession? = null
    private var authPending = false
    private var wanted = false
    private var closedByWearer = false
    private var lines: List<String> = emptyList()

    override fun connect() {
        wanted = true
        closedByWearer = false
        // The SDK ships native code for arm64-v8a and armeabi-v7a only; create() throws UnsatisfiedLinkError elsewhere
        if (Build.SUPPORTED_ABIS.none { it == "arm64-v8a" || it == "armeabi-v7a" }) {
            return host.onStatus(id, "not supported on this CPU (x86 emulator?)")
        }
        when (manager.checkRokidAppCompatibility(app)) {
            is RokidAppStatus.NotInstalled -> return host.onStatus(id, "install Hi Rokid and pair the glasses there")
            is RokidAppStatus.VersionTooLow -> return host.onStatus(id, "update Hi Rokid")
            else -> Unit
        }
        if (token == null) authorize() else open()
    }

    private fun authorize() {
        if (authPending) return
        authPending = true
        host.onStatus(id, "approve this app in Hi Rokid")
        // unverified: the docs do not say which permission a CUSTOM_VIEW needs; MEDIA is what we request.
        manager.requestAuthorization(host.activity, listOf(GlassPermission.MEDIA)) { result -> main.post { onAuth(result) } }
    }

    /** Hi Rokid answers through onActivityResult with request codes the SDK picks, so forward every result while waiting. */
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (authPending) manager.parseAuthorizationResult(resultCode, data ?: Intent())
    }

    private fun onAuth(result: AuthResult) {
        authPending = false
        val t = result.token
        if (result.isSuccess && !t.isNullOrEmpty()) {
            token = t
            if (wanted) open()
        } else {
            // NOT_AUTHENTICATED: not signed in to Hi Rokid. OPERATION_CANCELLED: the user said no.
            host.onStatus(id, "not approved: ${result.errorCode?.name ?: result.message}")
        }
    }

    private fun open() {
        val t = token ?: return authorize()
        if (session != null) return
        host.onStatus(id, "opening the view on the glasses")
        val s = try {
            manager.create(SessionConfig(sessionType = SessionType.CUSTOM_VIEW, viewData = viewJson()))
        } catch (e: IllegalStateException) {
            // One session per manager: the previous one is still closing
            Log.i(TAG, "create failed: $e")
            return host.onStatus(id, "busy, try again")
        }
        session = s
        s.addLifecycleCallback(lifecycle) // before connect, or early callbacks are lost
        s.connect(t)
    }

    private val lifecycle = object : ISessionLifecycleCbk {
        override fun onConnectResult(success: Boolean, errorCode: SessionErrorCode?) {
            if (success) return
            if (errorCode == SessionErrorCode.NOT_AUTHENTICATED || errorCode == SessionErrorCode.TOKEN_EXPIRED) token = null
            session = null
            host.onStatus(id, "connect failed: ${errorCode?.name} (glasses connected in Hi Rokid?)")
        }

        override fun onSessionStarted() {
            host.onStatus(id, "connected")
            push()
        }

        override fun onSessionPaused(reason: PausedReason) {
            // AI_ASSIST (the wearer talks to Rokid's assistant) or BT_DISCONNECTED: the view comes back by itself
            host.onStatus(id, "paused: ${reason.name}")
        }

        override fun onSessionResumed() {
            host.onStatus(id, "connected")
            push()
        }

        override fun onSessionTerminating(reason: TerminatingReason, gracePeriodMs: Long) {
            Log.i(TAG, "terminating: $reason")
        }

        override fun onSessionClosed(reason: CloseReason) {
            session = null
            // These two invalidate the token; the next connect asks Hi Rokid again (silently if still approved)
            if (reason == CloseReason.CHAIN_TORN || reason == CloseReason.LINK_LOST) token = null
            if (reason == CloseReason.GLASSES_EXIT) {
                // The wearer left our view: respect that until the user connects again from the phone
                closedByWearer = true
                host.onStatus(id, "closed on the glasses, press Connect to reopen")
            } else {
                host.onStatus(id, "closed: ${reason.name}")
            }
        }
    }

    override fun show(lines: List<String>) {
        this.lines = lines
        if (session == null && wanted && !closedByWearer && token != null) open() else push()
    }

    override fun clear() = show(emptyList())

    override fun disconnect() {
        wanted = false
        authPending = false
        lines = emptyList()
        session?.let {
            it.removeLifecycleCallback(lifecycle)
            it.close()
        }
        session = null
        host.onStatus(id, "disconnected")
    }

    private fun push() {
        val s = session ?: return
        if (s.getState() != SessionState.Started) return // Starting or Paused: pushed again on start or resume
        // Community reports (2026) say an update can return success without a redraw on some Hi Rokid builds;
        // if you see stale text, close and reopen the session instead of retrying the update.
        val r = s.customViewUpdate(updateJson())
        if (!r.isSuccess) Log.i(TAG, "customViewUpdate failed: ${r.message}")
    }

    // The view is a JSON tree of Android-like views. Rokid requires compact JSON with each "id" inside "props".
    // One TextView per line, because line breaks inside one text are not documented.
    private fun viewJson(): String {
        val children = JSONArray()
        for (i in 0 until budget.lines) {
            children.put(
                JSONObject().put("type", "TextView").put(
                    "props",
                    JSONObject()
                        .put("id", "l$i")
                        .put("layout_width", "match_parent")
                        .put("layout_height", "wrap_content")
                        .put("text", slot(i))
                        .put("textSize", "24sp")
                        .put("textColor", "#FF00FF00")
                        .put("gravity", "start"),
                ),
            )
        }
        val root = JSONObject()
            .put("id", "root")
            .put("layout_width", "match_parent")
            .put("layout_height", "match_parent")
            .put("orientation", "vertical")
            .put("gravity", "bottom") // keep the middle of the view free, captions sit low like subtitles
            .put("padding", "16dp")
            .put("backgroundColor", "#FF000000") // black = transparent on the waveguide
        return JSONObject().put("type", "LinearLayout").put("props", root).put("children", children).toString()
    }

    private fun updateJson(): String {
        val updates = JSONArray()
        for (i in 0 until budget.lines) {
            updates.put(
                JSONObject().put("action", "update").put("id", "l$i")
                    .put("props", JSONObject().put("text", slot(i))),
            )
        }
        return updates.toString()
    }

    /** Line [i] of the view; short text sits on the bottom lines, like subtitles. */
    private fun slot(i: Int): String = lines.getOrElse(i - (budget.lines - lines.size)) { "" }

    private companion object {
        const val TAG = "LiveCaptions.Rokid"
    }
}

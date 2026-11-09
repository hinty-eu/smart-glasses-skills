package dev.smartglasses.livecaptions

import android.app.Activity
import android.content.Intent

/**
 * One way of getting caption text in front of (or into the ear of) the wearer.
 * Every rung of the display-text ladder implements this, so the rest of the app never knows which glasses it drives.
 * All calls happen on the main thread.
 */
interface GlassesDisplay {
    /** Sent to the server in the hello message, e.g. "rokid". */
    val id: String

    /** How much text this target can show. The caption stream is fitted to it on the phone. */
    val budget: LineBudget

    /** Ask for whatever is needed (permission, companion app approval, display) and start. Progress goes to [DisplayHost.onStatus]. */
    fun connect()

    /** Replace what the wearer sees with these lines (already wrapped to [budget]). */
    fun show(lines: List<String>)

    /** Each final caption once, unwrapped. Targets that speak use this; drawing targets ignore it. */
    fun onFinal(text: String) {}

    /** Blank the display or stop talking, but stay connected. */
    fun clear()

    /** Give the display back to the companion app and release everything. */
    fun disconnect()
}

/**
 * [lines] x [cols] is the text budget. [partials] = false means the target only gets final captions
 * (notifications and speech would spam otherwise). [minIntervalMs] throttles partial updates for Bluetooth links.
 */
data class LineBudget(val lines: Int, val cols: Int, val partials: Boolean = true, val minIntervalMs: Long = 0)

/** The shared input actions. Every target maps its own gestures (taps, buttons, notification actions) to these. */
enum class InputAction(val wire: String) {
    /** Show (or say) the current caption again. */
    REPEAT("repeat"),

    /** Drop what is shown now and wait for the next caption. */
    SKIP("skip"),

    /** Blank the display until the next REPEAT or HIDE. */
    HIDE("hide"),
}

/** What a display needs from the app around it. */
interface DisplayHost {
    val activity: Activity

    fun onStatus(displayId: String, status: String)

    fun onAction(action: InputAction)

    /** Runtime permissions in one dialog; [then] runs with true when all of them are granted. */
    fun requestPermissions(vararg permissions: String, then: (granted: Boolean) -> Unit)
}

/** For displays whose SDK answers through Activity.onActivityResult (Rokid's authorization screen in Hi Rokid). */
interface ActivityResultAware {
    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?)
}

/** Rung 0 for testing without hardware: the phone preview in MainActivity is the only output. */
class PhonePreviewDisplay(private val host: DisplayHost) : GlassesDisplay {
    override val id = "phone"
    override val budget = LineBudget(lines = 3, cols = 32)

    override fun connect() = host.onStatus(id, "ready (phone preview only)")

    override fun show(lines: List<String>) = Unit

    override fun clear() = Unit

    override fun disconnect() = Unit
}

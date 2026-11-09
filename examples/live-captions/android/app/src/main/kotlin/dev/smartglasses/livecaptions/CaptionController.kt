package dev.smartglasses.livecaptions

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject

/**
 * Glue between the caption stream and one [GlassesDisplay]: fits the text to the display's budget, throttles partial
 * results for slow links, and applies the shared input actions. Main thread only.
 */
class CaptionController(
    private val onPreview: (lines: List<String>, hidden: Boolean) -> Unit,
    private val onSocketState: (String) -> Unit,
) : CaptionSocket.Listener {
    private val socket = CaptionSocket(this)
    private val captions = CaptionLines()
    private val main = Handler(Looper.getMainLooper())
    private var display: GlassesDisplay? = null
    private var shown: List<String> = emptyList()
    private var lastPushAt = 0L
    private var hidden = false
    private var connected = false
    private val trailingPush = Runnable { push(force = false) }

    fun start(server: String, room: String, target: GlassesDisplay) {
        setDisplay(target)
        socket.open(server, room, hello(target))
    }

    /** Swap glasses without dropping the connection. */
    fun setDisplay(target: GlassesDisplay) {
        if (target === display) return
        display?.disconnect()
        display = target
        shown = emptyList()
        target.connect()
        socket.sendHello(hello(target))
        push(force = true)
    }

    fun stop() {
        socket.close()
        main.removeCallbacks(trailingPush)
        display?.disconnect()
        display = null
        shown = emptyList()
        onSocketState("disconnected")
    }

    /** From any target's gestures, the notification buttons or the phone UI. */
    fun onAction(action: InputAction) {
        val d = display ?: return
        when (action) {
            InputAction.REPEAT -> {
                hidden = false
                // While connected, the server answers with the last final marked "repeat" to every screen in the room,
                // and onCaption shows and speaks it once. Without a server, repeat from here.
                if (!connected) {
                    d.show(shown.ifEmpty { captions.fit(d.budget) })
                    if (captions.lastFinal.isNotEmpty()) d.onFinal(captions.lastFinal)
                }
            }
            InputAction.SKIP -> {
                captions.clear()
                shown = emptyList()
                d.clear()
            }
            InputAction.HIDE -> {
                hidden = !hidden
                // [shown] keeps following the stream while hidden, so un-hiding shows the current text at once
                if (hidden) d.clear() else if (shown.isNotEmpty()) d.show(shown)
            }
        }
        onPreview(shown, hidden)
        socket.sendAction(action)
    }

    override fun onSocketState(state: String) {
        connected = state == "connected"
        onSocketState.invoke(state)
    }

    override fun onSocketOpen() = captions.resetSequence()

    override fun onCaption(seq: Int, text: String, final: Boolean, repeat: Boolean) {
        val d = display ?: return
        if (!captions.onCaption(seq, text, final, repeat)) return
        if (repeat) hidden = false // "show this again", whoever in the room asked for it
        if (final && !hidden && captions.lastFinal.isNotEmpty()) d.onFinal(captions.lastFinal)
        if (!final && !d.budget.partials) return
        push(force = final, redraw = repeat)
    }

    override fun onClear() {
        captions.clear()
        shown = emptyList()
        display?.clear()
        onPreview(shown, hidden)
    }

    /** [redraw] sends the lines even when they did not change (a repeat brings back text the glasses dropped). */
    private fun push(force: Boolean, redraw: Boolean = false) {
        val d = display ?: return
        val budget = d.budget
        val wait = lastPushAt + budget.minIntervalMs - SystemClock.uptimeMillis()
        if (!force && wait > 0) {
            // Too soon for this link: send the newest text once the interval is over
            main.removeCallbacks(trailingPush)
            main.postDelayed(trailingPush, wait)
            return
        }
        main.removeCallbacks(trailingPush)
        val lines = captions.fit(budget)
        if (lines == shown && !redraw) return
        shown = lines
        onPreview(lines, hidden)
        if (hidden) return
        lastPushAt = SystemClock.uptimeMillis()
        if (lines.isEmpty()) d.clear() else d.show(lines)
    }

    private fun hello(d: GlassesDisplay) = JSONObject()
        .put("type", "hello")
        .put("target", d.id)
        .put("lines", d.budget.lines)
        .put("cols", d.budget.cols)
}
